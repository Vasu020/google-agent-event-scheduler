// app/api/events/route.ts
import { dbGetEvents } from "@/app/agents/tools/gcal/client";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const events = await dbGetEvents();
    return NextResponse.json({ events });
  } catch (err: any) {
    console.error("[/api/events] error:", err.message);
    return NextResponse.json({ events: [], error: err.message }, { status: 200 });
  }
}