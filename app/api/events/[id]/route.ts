// app/api/events/[id]/route.ts
import { dbUpdateEvent, dbDeleteEvent } from "@/app/agents/tools/gcal/client";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, start, end, description } = body;

    const updated = await dbUpdateEvent(id, { title, start, end, description });
    if (!updated) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    return NextResponse.json({ event: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update event.";
    console.error("[/api/events/[id]] PATCH error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const removed = await dbDeleteEvent(id);
    if (!removed) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    return NextResponse.json({ event: removed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete event.";
    console.error("[/api/events/[id]] DELETE error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
