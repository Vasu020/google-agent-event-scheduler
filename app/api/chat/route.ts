// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { chat } from "../../agents/schedulerAgent";
import { dbGetEvents } from "@/app/agents/tools/gcal/client";

// Server-side dedup — keyed by sessionId, blocks concurrent identical requests
const activeRequests = new Map<string, Promise<NextResponse>>();

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { messages, sessionId } = body;
  const sid = sessionId ?? "default";

  // If a request for this session is already in-flight, return a wait message
  if (activeRequests.has(sid)) {
    return NextResponse.json({
      reply: "Still processing your previous request, please wait...",
      events: [],
    });
  }

  const promise = handleRequest(messages, sid);
  activeRequests.set(sid, promise);

  try {
    return await promise;
  } finally {
    activeRequests.delete(sid);
  }
}

async function handleRequest(messages: any[], sessionId: string): Promise<NextResponse> {
  try {
    if (!messages?.length) {
      const events = await dbGetEvents();
      return NextResponse.json({ reply: "No message received.", events });
    }

    const lastUserMessage = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === "user");

    if (!lastUserMessage) {
      return NextResponse.json({ reply: "No user message found.", events: [] });
    }

    console.log("[chat] user:", lastUserMessage.content, "| session:", sessionId);

    const reply = await chat(lastUserMessage.content, sessionId);
    console.log("[chat] reply:", reply);

    let events: any[] = [];
    try {
      events = await dbGetEvents();
    } catch (e: any) {
      console.error("[chat] gcal fetch error:", e.message);
    }

    return NextResponse.json({ reply, events });

  } catch (err: any) {
    console.error("[chat] error:", err.message);

    let events: any[] = [];
    try { events = await dbGetEvents(); } catch { }

    const msg = err?.message ?? "";
    const isRedis = msg.includes("ECONNREFUSED") || msg.includes("Redis");
    const isGCal = msg.includes("invalid_grant") || msg.includes("token");
    const isGemini = msg.includes("GOOGLE_AI_API_KEY") || msg.includes("403");
    const reply = isRedis ? "⚠️ Redis not running. Start it with: docker run -d -p 6379:6379 redis:alpine"
      : isGCal ? "⚠️ Google Calendar token expired. Run the auth setup again."
        : isGemini ? "⚠️ Google AI API key invalid. Check GOOGLE_AI_API_KEY in .env"
          : process.env.NODE_ENV === "development" ? `❌ ${msg}` : "Something went wrong. Please try again.";

    return NextResponse.json({ reply, events }, { status: 200 });
  }
}