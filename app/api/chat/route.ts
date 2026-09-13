// app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { chat } from "../../agents/schedulerAgent";

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

async function handleRequest(
  messages: { role: string; content: string }[],
  sessionId: string,
): Promise<NextResponse> {
  try {
    if (!messages?.length) {
      return NextResponse.json({ reply: "No message received." });
    }

    const lastUserMessage = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === "user");

    if (!lastUserMessage) {
      return NextResponse.json({ reply: "No user message found." });
    }

    console.log("[chat] user:", lastUserMessage.content, "| session:", sessionId);

    const reply = await chat(lastUserMessage.content, sessionId);
    console.log("[chat] reply:", reply);

    return NextResponse.json({ reply });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    console.error("[chat] error:", msg);

    const isRedis = msg.includes("ECONNREFUSED") || msg.includes("Redis");
    const isGCal = msg.includes("invalid_grant") || msg.includes("token");
    const isGemini = msg.includes("GOOGLE_AI_API_KEY") || msg.includes("403");
    const isQuota = msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");
    const reply = isRedis ? "⚠️ Redis not running. Start it with: docker run -d -p 6379:6379 redis:alpine"
      : isGCal ? "⚠️ Google Calendar token expired. Run the auth setup again."
        : isQuota ? "⚠️ Gemini free-tier daily quota reached for this model. It resets once a day — try again later, or switch to a model with a higher limit."
          : isGemini ? "⚠️ Google AI API key invalid. Check GOOGLE_AI_API_KEY in .env"
            : process.env.NODE_ENV === "development" ? `❌ ${msg}` : "Something went wrong. Please try again.";

    return NextResponse.json({ reply }, { status: 200 });
  }
}