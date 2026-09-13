// app/api/events/route.ts
import { dbGetEvents, dbGetEventsInRange, dbCreateEvent } from "@/app/agents/tools/gcal/client";
import { NextRequest, NextResponse } from "next/server";

// `dbGetEvents` only returns events from "now" onward, which is wrong for a
// calendar grid — a week/month view also needs events earlier the same day
// or earlier in the visible range. When the client reports the range it's
// currently showing (?from=&to=), fetch that range instead.
export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");

    const events = from && to ? await dbGetEventsInRange(from, to) : await dbGetEvents();
    return NextResponse.json({ events });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch events.";
    console.error("[/api/events] error:", message);
    return NextResponse.json({ events: [], error: message }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, start, end, description } = body;

    if (!title?.trim() || !start || !end) {
      return NextResponse.json(
        { error: "title, start, and end are required." },
        { status: 400 },
      );
    }

    const created = await dbCreateEvent({ id: "", title, start, end, description });
    return NextResponse.json({ event: created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create event.";
    console.error("[/api/events] POST error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}