"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Sparkles, Calendar, Clock } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

// Stable session ID — created once per page load, never recreated
const SESSION_ID = crypto.randomUUID();

const SUGGESTIONS = [
  "Schedule a meeting tomorrow at 2pm",
  "What's on my calendar this week?",
  "Move my 3pm call to 4pm",
];

export function ChatPanel({
  onEventsChange,
}: {
  // Called (no payload) after a reply, since /api/chat's own event list is
  // "upcoming only" and would clobber the calendar's range-correct one —
  // the parent should re-fetch by its currently visible range instead.
  onEventsChange?: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your scheduling assistant. You can say things like:\n- 'Schedule a meeting tomorrow at 2pm'\n- 'What's on my calendar for Friday?'\n- 'Move my 3pm call to 4pm'",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSendingRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading || isSendingRef.current) return;

    isSendingRef.current = true;
    setIsLoading(true);

    const userMsg: Message = {
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          sessionId: SESSION_ID,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply ?? "Something went wrong.",
          timestamp: new Date(),
        },
      ]);
      onEventsChange?.();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err instanceof Error
              ? err.message
              : "Network error. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        isSendingRef.current = false;
      }, 2000);
      textareaRef.current?.focus();
    }
  }, [input, isLoading, messages, onEventsChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date?: Date) =>
    date?.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }) ?? "";

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-icon">
          <Sparkles size={14} />
        </div>
        <div className="chat-header-text">
          <p className="chat-header-title">Scheduling Assistant</p>
          <p className="chat-header-sub">Powered by Google Calendar</p>
        </div>
        <div className="chat-header-badge">
          <span className="status-dot" />
          Live
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="chat-messages">
        <div className="messages-inner">
          {messages.map((msg, idx) =>
            msg.role === "assistant" ? (
              <div key={idx} className="msg-row msg-ai">
                <div className="msg-avatar ai-avatar">
                  <Calendar size={13} />
                </div>
                <div className="msg-content-wrap">
                  <div className="msg-bubble ai-bubble">
                    {msg.content.split("\n").map((line, i) => (
                      <p
                        key={i}
                        className={line.startsWith("-") ? "msg-list-item" : ""}
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                  <span className="msg-time">{formatTime(msg.timestamp)}</span>
                </div>
              </div>
            ) : (
              <div key={idx} className="msg-row msg-user">
                <div className="msg-content-wrap items-end">
                  <div className="msg-bubble user-bubble">
                    {msg.content.split("\n").map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                  <span className="msg-time">{formatTime(msg.timestamp)}</span>
                </div>
                <div className="msg-avatar user-avatar">U</div>
              </div>
            ),
          )}

          {isLoading && (
            <div className="msg-row msg-ai">
              <div className="msg-avatar ai-avatar">
                <Calendar size={13} />
              </div>
              <div className="typing-bubble">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Suggestions - Now more prominent */}
      {messages.length <= 1 && (
        <div className="suggestions">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              className="suggestion-chip"
              onClick={() => setInput(s)}
            >
              <Clock size={13} />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="chat-input-area">
        <div className="input-wrap">
          <Textarea
            ref={textareaRef}
            placeholder="Ask me to schedule, update, or cancel events…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="chat-textarea"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="send-btn"
            aria-label="Send"
          >
            <Send size={15} />
          </button>
        </div>
        <p className="input-hint">Enter to send · Shift+Enter for new line</p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        
        .chat-panel { 
          display:flex; 
          flex-direction:column; 
          height:100%; 
          background:#ffffff; 
          border-radius:18px; 
          overflow:hidden; 
          border:1px solid #e5e7eb; 
          font-family:'DM Sans',sans-serif; 
          box-shadow:0 20px 40px rgba(0,0,0,0.08); 
        }
        
        .chat-header { 
          display:flex; 
          align-items:center; 
          gap:12px; 
          padding:16px 20px; 
          background:#f8fafc; 
          border-bottom:1px solid #e5e7eb; 
        }
        
        .chat-header-icon {
          width:34px;
          height:34px;
          border-radius:10px;
          background:linear-gradient(135deg,#3b82f6,#6366f1);
          display:flex;
          align-items:center;
          justify-content:center;
          color:white;
          flex-shrink:0;
        }

        .chat-header-text {
          min-width:0;
          flex:1 1 auto;
        }

        .chat-header-title {
          font-size:15px;
          font-weight:600;
          color:#1f2937;
          margin:0;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        .chat-header-sub {
          font-size:12.5px;
          color:#64748b;
          margin:0;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        .chat-header-badge {
          margin-left:auto;
          flex-shrink:0;
          display:flex;
          align-items:center;
          gap:6px;
          font-size:12px;
          font-weight:500;
          color:#10b981;
          background:#ecfdf5;
          border:1px solid #a7f3d0;
          border-radius:9999px;
          padding:4px 12px;
        }
        
        .status-dot { 
          width:7px; 
          height:7px; 
          border-radius:50%; 
          background:#10b981; 
          animation:pulse-dot 2s infinite; 
        }
        
        @keyframes pulse-dot { 
          0%,100%{opacity:1} 50%{opacity:0.5} 
        }
        
        .chat-messages { flex:1; min-height:0; overflow:hidden; background:#fafcff; }
        .messages-inner { 
          padding:24px 20px; 
          display:flex; 
          flex-direction:column; 
          gap:20px; 
        }
        
        .msg-row { 
          display:flex; 
          align-items:flex-end; 
          gap:10px; 
          animation:fadeUp 0.3s ease; 
        }
        
        @keyframes fadeUp { 
          from{opacity:0;transform:translateY(12px)} 
          to{opacity:1;transform:translateY(0)} 
        }
        
        .msg-user { justify-content:flex-end; }
        
        .msg-avatar { 
          width:30px; 
          height:30px; 
          border-radius:10px; 
          display:flex; 
          align-items:center; 
          justify-content:center; 
          font-size:12px; 
          font-weight:600; 
          flex-shrink:0; 
        }
        
        .ai-avatar { 
          background:#f1f5f9; 
          color:#475569; 
          border:1px solid #e2e8f0; 
        }
        
        .user-avatar { 
          background:linear-gradient(135deg,#2563eb,#3b82f6); 
          color:white; 
        }
        
        .msg-content-wrap { 
          display:flex; 
          flex-direction:column; 
          gap:5px; 
          max-width:80%; 
        }
        
        .msg-bubble { 
          padding:12px 16px; 
          border-radius:14px; 
          font-size:15px; 
          line-height:1.55; 
        }
        
        .msg-bubble p { margin:0; }
        .msg-bubble p+p { margin-top:4px; }
        .msg-list-item { padding-left:6px; color:#475569; }
        
        .ai-bubble { 
          background:#ffffff; 
          color:#1f2937; 
          border:1px solid #e2e8f0; 
          border-bottom-left-radius:4px; 
        }
        
        .user-bubble { 
          background:linear-gradient(135deg,#2563eb,#3b82f6); 
          color:#fff; 
          border-bottom-right-radius:4px; 
          box-shadow:0 4px 20px rgba(59,130,246,0.3); 
        }
        
        .msg-time { 
          font-size:11px; 
          color:#94a3b8; 
          font-family:'JetBrains Mono',monospace; 
        }
        
        .typing-bubble { 
          display:flex; 
          align-items:center; 
          gap:5px; 
          padding:14px 16px; 
          background:#ffffff; 
          border:1px solid #e2e8f0; 
          border-radius:14px; 
          border-bottom-left-radius:4px; 
        }
        
        .typing-bubble span { 
          width:6px; 
          height:6px; 
          border-radius:50%; 
          background:#94a3b8; 
          animation:bounce 1.2s infinite; 
        }
        
        .typing-bubble span:nth-child(2){animation-delay:0.2s}
        .typing-bubble span:nth-child(3){animation-delay:0.4s}
        
        @keyframes bounce { 
          0%,60%,100%{transform:translateY(0)} 
          30%{transform:translateY(-5px)} 
        }
        
        /* Suggestions - Highlighted & Distinct Background */
        .suggestions { 
          padding:16px 20px 12px; 
          background:#f1f5f9; 
          border-top:1px solid #e5e7eb; 
          display:flex; 
          flex-wrap:wrap; 
          gap:8px; 
        }
        
        .suggestion-chip { 
          display:flex; 
          align-items:center; 
          gap:8px; 
          padding:9px 16px; 
          background:white; 
          border:1px solid #dbeafe; 
          border-radius:9999px; 
          color:#1e40af; 
          font-size:14px; 
          font-weight:500; 
          cursor:pointer; 
          transition:all 0.2s cubic-bezier(0.4, 0, 0.2, 1); 
          box-shadow:0 1px 3px rgba(0,0,0,0.05); 
        }
        
        .suggestion-chip:hover { 
          background:#eff6ff; 
          border-color:#3b82f6; 
          transform:translateY(-1px); 
          box-shadow:0 4px 12px rgba(59,130,246,0.15); 
        }
        
        .chat-input-area { 
          padding:16px 20px 18px; 
          border-top:1px solid #e5e7eb; 
          background:#ffffff; 
        }
        
        .input-wrap { 
          display:flex; 
          align-items:flex-end; 
          gap:10px; 
          background:#f8fafc; 
          border:1px solid #e2e8f0; 
          border-radius:14px; 
          padding:10px 12px 10px 16px; 
          transition:all 0.2s; 
        }
        
        .input-wrap:focus-within { 
          border-color:#3b82f6; 
          background:white; 
          box-shadow:0 0 0 4px rgba(59,130,246,0.1); 
        }
        
        .chat-textarea { 
          flex:1; 
          background:transparent!important; 
          border:none!important; 
          box-shadow:none!important; 
          outline:none!important; 
          resize:none; 
          font-size:15px; 
          font-family:'DM Sans',sans-serif; 
          color:#1f2937; 
          padding:4px 0!important; 
          min-height:24px!important; 
          max-height:140px; 
          line-height:1.5; 
        }
        
        .chat-textarea::placeholder { 
          color:#94a3b8; 
          font-size:15px; 
        }
        
        .send-btn { 
          width:36px; 
          height:36px; 
          border-radius:10px; 
          background:linear-gradient(135deg,#2563eb,#3b82f6); 
          border:none; 
          cursor:pointer; 
          display:flex; 
          align-items:center; 
          justify-content:center; 
          color:white; 
          flex-shrink:0; 
          transition:all 0.2s ease; 
        }
        
        .send-btn:hover:not(:disabled) { 
          background:linear-gradient(135deg,#1d4ed8,#2563eb); 
          transform:scale(1.08); 
        }
        
        .send-btn:disabled { 
          opacity:0.5; 
          cursor:not-allowed; 
        }
        
        .input-hint { 
          font-size:11px; 
          color:#94a3b8; 
          margin:6px 4px 0; 
          font-family:'JetBrains Mono',monospace; 
        }
      `}</style>
    </div>
  );
}