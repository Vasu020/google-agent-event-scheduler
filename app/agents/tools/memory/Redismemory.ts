// lib/redisMemory.ts
// Uses the official `redis` npm package (not ioredis) which works correctly
// in Next.js server components and API routes without connection retry issues.

import { createClient, RedisClientType } from "redis";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";

// ── Singleton client ──────────────────────────────────────────────────────────

let client: RedisClientType | null = null;

async function getClient(): Promise<RedisClientType> {
  if (client && client.isOpen) return client;

  client = createClient({
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 3) return new Error("Redis unavailable");
        return Math.min(retries * 100, 500);
      },
    },
  }) as RedisClientType;

  client.on("error", (err) => {
    console.error("[Redis] connection error:", err.message);
  });

  await client.connect();
  return client;
}

// ── Key & TTL ─────────────────────────────────────────────────────────────────

const KEY = (sessionId: string) => `chat_history:${sessionId}`;
const TTL = 60 * 60; // 1 hour

// ── Serialization ─────────────────────────────────────────────────────────────

type StoredMessage = { role: "human" | "ai"; content: string };

function serialize(msg: BaseMessage): string {
  const role = msg._getType() === "human" ? "human" : "ai";
  const content =
    typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
  return JSON.stringify({ role, content } satisfies StoredMessage);
}

function deserialize(raw: string): BaseMessage {
  const { role, content }: StoredMessage = JSON.parse(raw);
  return role === "human" ? new HumanMessage(content) : new AIMessage(content);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getHistory(sessionId: string): Promise<BaseMessage[]> {
  try {
    const redis = await getClient();
    const items = await redis.lRange(KEY(sessionId), 0, -1);
    return items.map(deserialize);
  } catch (err: any) {
    console.error("[Redis] getHistory failed:", err.message);
    return []; // graceful degradation — agent runs without memory
  }
}

export async function saveMessages(
  sessionId: string,
  messages: BaseMessage[]
): Promise<void> {
  if (!messages.length) return;
  try {
    const redis = await getClient();
    const key = KEY(sessionId);
    await redis.rPush(key, messages.map(serialize));
    await redis.expire(key, TTL);
  } catch (err: any) {
    console.error("[Redis] saveMessages failed:", err.message);
    // non-fatal — reply already sent, just history won't persist
  }
}

export async function clearHistory(sessionId: string): Promise<void> {
  try {
    const redis = await getClient();
    await redis.del(KEY(sessionId));
  } catch (err: any) {
    console.error("[Redis] clearHistory failed:", err.message);
  }
}