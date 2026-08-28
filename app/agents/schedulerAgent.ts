// agents/schedulerAgent.ts
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { SystemMessage, BaseMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  addEventTool,
  cancelEventTool,
  listEventsTool,
  updateEventTool,
} from "./tools";
import {
  getHistory,
  saveMessages,
  clearHistory,
} from "./tools/memory/Redismemory";

// ── Model ─────────────────────────────────────────────────────────────────────
// Gemini 2.0 Flash — fast, cheap, excellent tool-calling reliability.
// gemini-2.0-flash-exp is free on Google AI Studio (no billing needed).
// For production swap to: gemini-1.5-pro  or  gemini-2.0-flash
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  apiKey: process.env.GOOGLE_AI_API_KEY,
  temperature: 0,
  maxRetries: 2,

});

// ── IST date context ──────────────────────────────────────────────────────────
function getISTContext() {
  const pad = (n: number) => String(n).padStart(2, "0");
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth(); // 0-indexed

  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

  const today = fmt(istNow);
  const tomorrow = fmt(new Date(istNow.getTime() + 86_400_000));

  const dow = istNow.getUTCDay();
  const toMon = dow === 0 ? -6 : 1 - dow;
  const weekStart = fmt(new Date(istNow.getTime() + toMon * 86_400_000));
  const weekEnd = fmt(new Date(istNow.getTime() + (toMon + 6) * 86_400_000));

  const monthStart = `${y}-${pad(m + 1)}-01`;
  const monthEnd = fmt(new Date(Date.UTC(y, m + 1, 0)));
  const nm = (m + 1) % 12;
  const ny = m + 1 > 11 ? y + 1 : y;
  const nextMonthStart = `${ny}-${pad(nm + 1)}-01`;
  const nextMonthEnd = fmt(new Date(Date.UTC(ny, nm + 1, 0)));

  const weekdayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][istNow.getUTCDay()];
  const monthName = istNow.toLocaleString("en-IN", { month: "long", timeZone: "Asia/Kolkata" });
  const nextMonthName = new Date(Date.UTC(ny, nm, 1)).toLocaleString("en-IN", { month: "long", timeZone: "Asia/Kolkata" });

  return {
    today, tomorrow, weekStart, weekEnd,
    monthStart, monthEnd, nextMonthStart, nextMonthEnd,
    weekdayName, monthName, nextMonthName, year: String(y),
  };
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(c: ReturnType<typeof getISTContext>): SystemMessage {
  return new SystemMessage(`
You are a personal scheduling assistant connected to Google Calendar.
Timezone: Asia/Kolkata (IST, UTC+5:30). Always work in IST.

═══════════════════════════════════════
DATE CONTEXT  (use EXACTLY these values — do not calculate your own)
═══════════════════════════════════════
TODAY          : ${c.today} (${c.weekdayName})
TOMORROW       : ${c.tomorrow}
THIS WEEK      : ${c.weekStart} → ${c.weekEnd}
THIS MONTH     : ${c.monthStart} → ${c.monthEnd}  (${c.monthName} ${c.year})
NEXT MONTH     : ${c.nextMonthStart} → ${c.nextMonthEnd}  (${c.nextMonthName} ${c.year})

═══════════════════════════════════════
DATETIME FORMAT RULES
═══════════════════════════════════════
addEvent / updateEvent start & end  →  YYYY-MM-DDTHH:MM:SS+05:30
listEvents from & to                →  YYYY-MM-DD  (date only, no time)

Time word → ISO conversion:
  "2pm"       → T14:00:00+05:30       "2:30pm"  → T14:30:00+05:30
  "10am"      → T10:00:00+05:30       "noon"    → T12:00:00+05:30
  "midnight"  → T00:00:00+05:30       "morning" → T09:00:00+05:30
  "afternoon" → T14:00:00+05:30       "evening" → T18:00:00+05:30

Date phrase → listEvents range (copy these exactly):
  "today"                              → from=${c.today} to=${c.today}
  "tomorrow"                           → from=${c.tomorrow} to=${c.tomorrow}
  "this week"                          → from=${c.weekStart} to=${c.weekEnd}
  "this month" / "in ${c.monthName}"  → from=${c.monthStart} to=${c.monthEnd}
  "next month" / "in ${c.nextMonthName}" → from=${c.nextMonthStart} to=${c.nextMonthEnd}

Default event duration: 1 hour (if user does not specify end time).
NEVER produce partial dates like "2026-06-0/" — always full YYYY-MM-DD.

═══════════════════════════════════════
TOOL USAGE RULES
═══════════════════════════════════════
ADD a new event
  User says: "schedule", "add", "create", "book", "set up"
  → call addEvent ONCE → reply
  ⚠ NEVER use addEvent for rescheduling/renaming

UPDATE an existing event
  User says: "change", "move", "reschedule", "rename", "shift", "edit",
             "modify", "postpone", "push", "bring forward", "adjust"
  → call listEvents ONCE (to get the id)
  → call updateEvent ONCE with that exact id
  ⚠ NEVER call addEvent for these words

CANCEL an event
  User says: "cancel", "delete", "remove", "drop"
  → call listEvents ONCE (to get the id)
  → call cancelEvent ONCE with that exact id

LIST / VIEW events
  User says: "show", "list", "what's on", "do I have", "my schedule", "any events"
  → call listEvents ONCE → reply

HARD RULES — never break these:
  - Each tool called at most ONCE per user turn
  - Never call listEvents after a mutation (add/update/cancel)
  - Never guess an event id — always read it from listEvents output
  - If a tool returns an error string, report it to the user — do not retry
  - If multiple events match the description, ask user to clarify before acting

═══════════════════════════════════════
REPLY STYLE
═══════════════════════════════════════
- Plain conversational English — no raw JSON, no event IDs, no markdown tables
- Mutations: confirm with event title + date + time in 12-hour IST format
- Lists: numbered, one event per line — title, date, start–end time
- Nothing found: say so and offer to check a wider date range
`.trim());
}

// ── Reply extraction ──────────────────────────────────────────────────────────
function extractReply(messages: BaseMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const content = messages[i]?.content;
    if (typeof content === "string" && content.trim())
      return content.trim();
    if (Array.isArray(content)) {
      const text = content
        .filter((c: any) => c.type === "text" && c.text?.trim())
        .map((c: any) => c.text.trim())
        .join("\n");
      if (text) return text;
    }
  }
  return "Done — your calendar has been updated.";
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function chat(
  userInput: string,
  sessionId: string,
): Promise<string> {
  if (!userInput?.trim()) return "I didn't catch that — could you rephrase?";

  const ctx = getISTContext();
  const agent = createReactAgent({
    llm: model,
    tools: [listEventsTool, addEventTool, updateEventTool, cancelEventTool],
    messageModifier: buildSystemPrompt(ctx),
  });

  const history = await getHistory(sessionId);

  let result: Awaited<ReturnType<typeof agent.invoke>>;
  try {
    result = await agent.invoke({
      messages: [...history, { role: "user", content: userInput }],
    });
  } catch (err: any) {
    const msg: string = err?.message ?? "";
    if (msg.includes("API_KEY") || msg.includes("403") || msg.includes("PERMISSION"))
      throw new Error("Google AI API key invalid or missing. Check GOOGLE_AI_API_KEY in .env.");
    if (msg.includes("ECONNREFUSED") || msg.toLowerCase().includes("redis"))
      throw new Error("Redis is not running. Start it: docker run -d -p 6379:6379 redis:alpine");
    throw err;
  }

  const allMessages: BaseMessage[] = result.messages;
  await saveMessages(sessionId, allMessages.slice(history.length));
  return extractReply(allMessages);
}

export { clearHistory };