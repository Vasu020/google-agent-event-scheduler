// gcal/client.ts
// Google Calendar API client.
// Google Calendar IS the database — no local storage.

import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import fs from "fs";
import path from "path";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;       // ISO datetime string (with offset)
  end: string;         // ISO datetime string (with offset)
  description?: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TIMEZONE = "Asia/Kolkata";
const CALENDAR_ID = "primary";
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");
const SCOPES = ["https://www.googleapis.com/auth/calendar"];

// ── Auth singleton ────────────────────────────────────────────────────────────
// Read credentials and token ONCE at startup, not on every request.
// This eliminates the file-read race that caused intermittent 400 errors.

let _authClient: OAuth2Client | null = null;

function getAuthClient(): OAuth2Client {
  if (_authClient) return _authClient;

  const raw = fs.readFileSync(CREDENTIALS_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  const { client_id, client_secret, redirect_uris } =
    parsed.web ?? parsed.installed;

  const client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0],
  );

  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
  client.setCredentials(token);

  // Persist refreshed tokens back to disk automatically
  client.on("tokens", (newTokens) => {
    try {
      const existing = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
      fs.writeFileSync(
        TOKEN_PATH,
        JSON.stringify({ ...existing, ...newTokens }, null, 2),
      );
      // Update the in-memory client so it uses the new token immediately
      client.setCredentials({ ...existing, ...newTokens });
    } catch (err) {
      console.error("[gcal] Failed to persist refreshed token:", err);
    }
  });

  _authClient = client;
  return _authClient;
}

// ── Calendar service singleton ────────────────────────────────────────────────

let _service: ReturnType<typeof google.calendar> | null = null;

function getService() {
  if (!_service) {
    _service = google.calendar({ version: "v3", auth: getAuthClient() });
  }
  return _service;
}

// ── Auth setup (run once via: npx ts-node gcal/setup.ts) ─────────────────────

export async function runAuthSetup() {
  const raw = fs.readFileSync(CREDENTIALS_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  const { client_id, client_secret, redirect_uris } =
    parsed.web ?? parsed.installed;

  const client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0],
  );

  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Open this URL in your browser:\n", authUrl);

  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const code = await new Promise<string>((res) =>
    rl.question("\nPaste the code here: ", res),
  );
  rl.close();

  const { tokens } = await client.getToken(code);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log("token.json saved. Auth complete.");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCalendarEvent(gEvent: any): CalendarEvent {
  return {
    id: gEvent.id ?? "",
    title: gEvent.summary ?? "(No title)",
    start: gEvent.start?.dateTime ?? gEvent.start?.date ?? "",
    end: gEvent.end?.dateTime ?? gEvent.end?.date ?? "",
    description: gEvent.description ?? undefined,
  };
}

/**
 * Convert a YYYY-MM-DD date string to a UTC ISO string at the
 * START (00:00:00 IST) or END (23:59:59 IST) of that day.
 *
 * Why: Google Calendar's timeMin/timeMax must be RFC 3339 datetimes.
 * Passing bare "2026-06-01" causes a 400. We anchor to IST boundaries
 * so a June query doesn't bleed into May (UTC offset issue).
 */
function dateToIST(dateStr: string, boundary: "start" | "end"): string {
  const time = boundary === "start" ? "T00:00:00+05:30" : "T23:59:59+05:30";
  return new Date(`${dateStr.slice(0, 10)}${time}`).toISOString();
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * List all upcoming events (next 50).
 * Used by the calendar panel to display events — NOT for agent tool queries.
 */
export async function dbGetEvents(): Promise<CalendarEvent[]> {
  const svc = getService();
  try {
    const res = await svc.events.list({
      calendarId: CALENDAR_ID,
      timeMin: new Date().toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: "startTime",
    });
    return (res.data.items ?? []).map(toCalendarEvent);
  } catch (err: any) {
    console.error("[gcal] dbGetEvents failed:", err.message);
    return [];
  }
}

/**
 * List events between two YYYY-MM-DD date strings (IST boundaries).
 *
 * @param from  YYYY-MM-DD — query start (00:00:00 IST)
 * @param to    YYYY-MM-DD — query end   (23:59:59 IST)
 */
export async function dbGetEventsInRange(
  from: string,
  to: string,
): Promise<CalendarEvent[]> {
  // Validate format before hitting the API
  if (!/^\d{4}-\d{2}-\d{2}/.test(from) || !/^\d{4}-\d{2}-\d{2}/.test(to)) {
    throw new Error(
      `Invalid date format — expected YYYY-MM-DD, got from="${from}" to="${to}"`,
    );
  }

  const timeMin = dateToIST(from, "start"); // e.g. 2026-05-31T18:30:00.000Z
  const timeMax = dateToIST(to, "end");   // e.g. 2026-06-30T18:29:59.000Z

  console.log(`[gcal] dbGetEventsInRange timeMin=${timeMin} timeMax=${timeMax}`);

  const svc = getService();
  const res = await svc.events.list({
    calendarId: CALENDAR_ID,
    timeMin,
    timeMax,
    singleEvents: true,    // required for timeMin/timeMax range queries
    orderBy: "startTime", // required when singleEvents: true
    maxResults: 100,
  });

  return (res.data.items ?? []).map(toCalendarEvent);
}

/**
 * Create a new event. start/end must be full ISO datetimes with offset.
 */
export async function dbCreateEvent(
  event: CalendarEvent,
): Promise<CalendarEvent> {
  // Guard: bare dates without time (YYYY-MM-DD) will be created as all-day
  // events which behave differently — reject them early.
  if (!event.start.includes("T") || !event.end.includes("T")) {
    throw new Error(
      `start and end must be ISO datetimes (e.g. 2026-06-08T14:00:00+05:30), ` +
      `got start="${event.start}" end="${event.end}"`,
    );
  }

  const svc = getService();
  const res = await svc.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: event.title,
      description: event.description,
      start: { dateTime: event.start, timeZone: TIMEZONE },
      end: { dateTime: event.end, timeZone: TIMEZONE },
    },
  });
  return toCalendarEvent(res.data);
}

/**
 * Patch an existing event. Only provided fields are changed.
 * Returns null if the event ID does not exist.
 */
export async function dbUpdateEvent(
  id: string,
  fields: Partial<Omit<CalendarEvent, "id">>,
): Promise<CalendarEvent | null> {
  const svc = getService();

  // Fetch current state so we can merge (patch, not blind overwrite)
  let existing: any;
  try {
    const res = await svc.events.get({ calendarId: CALENDAR_ID, eventId: id });
    existing = res.data;
  } catch {
    return null; // event not found
  }

  // Validate any new datetimes before patching
  if (fields.start && !fields.start.includes("T")) {
    throw new Error(`start must be an ISO datetime, got "${fields.start}"`);
  }
  if (fields.end && !fields.end.includes("T")) {
    throw new Error(`end must be an ISO datetime, got "${fields.end}"`);
  }

  // If only start changes, auto-shift end by the same duration
  let newStart = fields.start ?? null;
  let newEnd = fields.end ?? null;

  if (newStart && !newEnd) {
    const originalDuration =
      new Date(existing.end?.dateTime ?? existing.end?.date).getTime() -
      new Date(existing.start?.dateTime ?? existing.start?.date).getTime();
    newEnd = new Date(
      new Date(newStart).getTime() + originalDuration,
    ).toISOString();
  }

  const requestBody = {
    summary: fields.title ?? existing.summary,
    description: fields.description ?? existing.description,
    start: newStart
      ? { dateTime: newStart, timeZone: TIMEZONE }
      : existing.start,
    end: newEnd
      ? { dateTime: newEnd, timeZone: TIMEZONE }
      : existing.end,
  };

  const res = await svc.events.update({
    calendarId: CALENDAR_ID,
    eventId: id,
    requestBody,
  });

  return toCalendarEvent(res.data);
}

/**
 * Delete an event by ID.
 * Returns the event details (for confirmation message) or null if not found.
 */
export async function dbDeleteEvent(
  id: string,
): Promise<CalendarEvent | null> {
  const svc = getService();

  let existing: any;
  try {
    const res = await svc.events.get({ calendarId: CALENDAR_ID, eventId: id });
    existing = res.data;
  } catch {
    return null; // already gone or wrong ID
  }

  await svc.events.delete({ calendarId: CALENDAR_ID, eventId: id });
  return toCalendarEvent(existing);
}