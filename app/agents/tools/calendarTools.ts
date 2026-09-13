// agents/tools.ts
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  dbGetEventsInRange,
  dbCreateEvent,
  dbUpdateEvent,
  dbDeleteEvent,
  dbGetEvents,
  type CalendarEvent,
} from "./gcal/client";

export const getEvents = dbGetEvents;
export type { CalendarEvent };

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Validate YYYY-MM-DD. Returns error string or null. */
function validateDate(value: string, label: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    return `${label} must be YYYY-MM-DD (e.g. 2026-06-01), got: "${value}"`;
  const d = new Date(value);
  if (isNaN(d.getTime()))
    return `${label} "${value}" is not a valid calendar date.`;
  return null;
}

/** Validate ISO datetime with optional offset. Returns error string or null. */
function validateDatetime(value: string, label: string): string | null {
  // Accept: 2026-06-01T14:00:00  or  2026-06-01T14:00:00+05:30  or with Z
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)?$/.test(value))
    return `${label} must be ISO datetime e.g. 2026-06-01T14:00:00+05:30, got: "${value}"`;
  if (isNaN(new Date(value).getTime()))
    return `${label} "${value}" is not a valid datetime.`;
  return null;
}

/** Append IST offset if no timezone info is present on a datetime string. */
function ensureIST(dt: string): string {
  // Already has offset or Z → leave as-is
  if (/([+-]\d{2}:\d{2}|Z)$/.test(dt)) return dt;
  return `${dt}+05:30`;
}

/** Format a CalendarEvent into a single readable line for confirmations. */
function fmtEvent(e: CalendarEvent): string {
  const start = e.start ? new Date(e.start).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "?";
  const end = e.end ? new Date(e.end).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "?";
  return `"${e.title}" from ${start} to ${end} (id: ${e.id})`;
}

// ── List ──────────────────────────────────────────────────────────────────────
export const listEventsTool = tool(
  async ({ from, to }) => {
    try {
      // Resolve defaults in IST
      const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      const todayISO = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;

      const startRaw = from ?? todayISO;
      const endRaw = to ?? (() => {
        const d = new Date(now.getTime() + 30 * 86400000);
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      })();

      // Validate
      const errFrom = validateDate(startRaw, "from");
      if (errFrom) return errFrom;
      const errTo = validateDate(endRaw, "to");
      if (errTo) return errTo;

      if (new Date(startRaw) > new Date(endRaw))
        return `"from" (${startRaw}) is after "to" (${endRaw}). Swap them.`;

      // Convert to full IST datetimes (start of day → end of day)
      const start = new Date(`${startRaw}T00:00:00+05:30`).toISOString();
      const end = new Date(`${endRaw}T23:59:59+05:30`).toISOString();

      const events = await dbGetEventsInRange(start, end);
      if (!events.length)
        return `No events found between ${startRaw} and ${endRaw}.`;

      // Return structured list the LLM can parse for IDs
      const lines = events.map((e, i) => {
        const s = new Date(e.start).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        const en = new Date(e.end).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        return `${i + 1}. [id: ${e.id}] "${e.title}" — ${s} to ${en}`;
      });
      return `Found ${events.length} event(s):\n${lines.join("\n")}`;
    } catch (err: any) {
      return `Failed to list events: ${err.message}`;
    }
  },
  {
    name: "listEvents",
    description: `List Google Calendar events between two dates.
Use this to find event IDs before calling updateEvent or cancelEvent.

Rules:
- Pass dates as YYYY-MM-DD strings only, never datetimes.
- For a single day: from="2026-06-08" to="2026-06-08"
- For a full month: from="2026-06-01" to="2026-06-30"
- Omit both to get the next 30 days.
- The result includes each event's id — copy it exactly for update/cancel.`,
    schema: z.object({
      from: z.string().optional().describe('Start date YYYY-MM-DD, e.g. "2026-06-01"'),
      to: z.string().optional().describe('End date   YYYY-MM-DD, e.g. "2026-06-30"'),
    }),
  },
);

// ── Add ───────────────────────────────────────────────────────────────────────
export const addEventTool = tool(
  async ({ title, start, end, description }) => {
    try {
      // Validate start
      const errStart = validateDatetime(start, "start");
      if (errStart) return errStart;

      // Validate end if provided
      if (end) {
        const errEnd = validateDatetime(end, "end");
        if (errEnd) return errEnd;
      }

      const startIST = ensureIST(start);
      const endIST = end
        ? ensureIST(end)
        : new Date(new Date(startIST).getTime() + 60 * 60 * 1000).toISOString();

      if (new Date(startIST) >= new Date(endIST))
        return `start (${start}) must be before end (${end}).`;

      const draft: CalendarEvent = {
        id: "",
        title,
        start: startIST,
        end: endIST,
        description,
      };

      const created = await dbCreateEvent(draft);
      return `✓ Created ${fmtEvent(created)}`;
    } catch (err: any) {
      return `Failed to create event: ${err.message}`;
    }
  },
  {
    name: "addEvent",
    description: `Add a NEW event to Google Calendar.
Only call this for brand-new events — never for rescheduling or renaming.

Rules:
- start and end must be ISO datetimes: 2026-06-08T14:00:00+05:30
- If the user says "2pm" → 2026-06-08T14:00:00+05:30
- If no end given, defaults to 1 hour after start.
- Always include +05:30 suffix for IST times.`,
    schema: z.object({
      title: z.string().describe("Event title"),
      start: z.string().describe('ISO datetime with offset, e.g. "2026-06-08T14:00:00+05:30"'),
      end: z.string().optional().describe('ISO datetime. Defaults to 1hr after start.'),
      description: z.string().optional().describe("Optional event description"),
    }),
  },
);

// ── Update ────────────────────────────────────────────────────────────────────
export const updateEventTool = tool(
  async ({ id, title, start, end, description }) => {
    try {
      if (!id?.trim())
        return `Event id is required. Call listEvents first to get the correct id.`;

      // Validate any datetime fields provided
      if (start) {
        const err = validateDatetime(start, "start");
        if (err) return err;
      }
      if (end) {
        const err = validateDatetime(end, "end");
        if (err) return err;
      }

      const startIST = start ? ensureIST(start) : undefined;
      const endIST = end ? ensureIST(end) : undefined;

      // If only start is given, shift end by same duration as original
      const fields: Partial<CalendarEvent> = Object.fromEntries(
        Object.entries({
          title,
          start: startIST,
          end: endIST,
          description,
        }).filter(([, v]) => v !== undefined),
      );

      if (Object.keys(fields).length === 0)
        return "Nothing to update — provide at least one of: title, start, end, description.";

      const updated = await dbUpdateEvent(id, fields);
      if (!updated)
        return `No event found with id "${id}". Call listEvents to get a valid id.`;

      return `✓ Updated ${fmtEvent(updated)}`;
    } catch (err: any) {
      return `Failed to update event: ${err.message}`;
    }
  },
  {
    name: "updateEvent",
    description: `Update/reschedule/rename an existing Google Calendar event.

MANDATORY: Always call listEvents FIRST to get the event id.
Never guess the id — it looks like "abc123xyz_20260608T090000Z".

Rules:
- id is required and must come from a listEvents result.
- Provide only the fields you want to change (title, start, end, description).
- Datetimes must include +05:30 for IST, e.g. 2026-06-08T16:00:00+05:30`,
    schema: z.object({
      id: z.string().describe("Event id from listEvents — required"),
      title: z.string().optional().describe("New title"),
      start: z.string().optional().describe('New start: "2026-06-08T16:00:00+05:30"'),
      end: z.string().optional().describe('New end:   "2026-06-08T17:00:00+05:30"'),
      description: z.string().optional().describe("New description"),
    }),
  },
);

// ── Cancel ────────────────────────────────────────────────────────────────────
export const cancelEventTool = tool(
  async ({ id }) => {
    try {
      if (!id?.trim())
        return `Event id is required. Call listEvents first to get the correct id.`;

      const removed = await dbDeleteEvent(id);
      if (!removed)
        return `No event found with id "${id}". Call listEvents to confirm the id.`;

      return `✓ Cancelled ${fmtEvent(removed)}`;
    } catch (err: any) {
      return `Failed to cancel event: ${err.message}`;
    }
  },
  {
    name: "cancelEvent",
    description: `Cancel/delete a Google Calendar event by its id.

MANDATORY: Always call listEvents FIRST to get the event id.
Never guess the id.`,
    schema: z.object({
      id: z.string().describe("Event id from listEvents — required"),
    }),
  },
);