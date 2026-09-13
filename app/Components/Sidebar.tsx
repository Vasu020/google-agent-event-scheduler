"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Sparkles } from "lucide-react";

interface SidebarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onCreateClick: () => void;
}

export function Sidebar({ selectedDate, onDateSelect, onCreateClick }: SidebarProps) {
  return (
    <div className="app-sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Sparkles size={16} />
        </div>
        <span className="brand-name">Scheduler</span>
      </div>

      <Button onClick={onCreateClick} className="create-btn">
        <Plus className="h-5 w-5" />
        Create
      </Button>

      <div className="mini-cal-card">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && onDateSelect(date)}
          className="mini-cal"
          classNames={{
            selected: "bg-blue-600 text-white",
            today: "text-blue-600 font-semibold",
          }}
        />
      </div>

      <div className="calendars-card">
        <p className="section-label">My calendars</p>
        <div className="calendar-row">
          <span className="calendar-dot" />
          <span>Primary</span>
        </div>
      </div>

      <div className="tips-card">
        <p className="tips-title">💡 Quick tips</p>
        <p className="tips-text">Try typing natural language in chat:</p>
        <p className="tips-example">&ldquo;Meeting with team tomorrow at 3pm&rdquo;</p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

        .app-sidebar {
          width: 280px;
          flex-shrink: 0;
          background: #ffffff;
          border-right: 1px solid #e5e7eb;
          padding: 20px 18px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          font-family: 'DM Sans', sans-serif;
          overflow-y: auto;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 2px 4px;
        }
        .brand-icon {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          background: linear-gradient(135deg,#3b82f6,#6366f1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          flex-shrink: 0;
        }
        .brand-name {
          font-size: 16px;
          font-weight: 700;
          color: #1f2937;
          letter-spacing: -0.01em;
        }

        .create-btn {
          width: 100%;
          height: 48px !important;
          border-radius: 9999px !important;
          font-size: 15px;
          font-weight: 600;
          gap: 10px;
          background: linear-gradient(135deg,#2563eb,#4f46e5) !important;
          box-shadow: 0 8px 20px rgba(37,99,235,0.28);
          transition: all 0.2s ease;
        }
        .create-btn:hover {
          box-shadow: 0 10px 26px rgba(37,99,235,0.36);
          transform: translateY(-1px);
        }

        .mini-cal-card {
          background: #ffffff;
          border: 1px solid #eef0f3;
          border-radius: 16px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.04);
          padding: 8px;
        }
        .mini-cal { width: 100%; }

        .calendars-card {
          background: #f8fafc;
          border-radius: 14px;
          padding: 14px 14px;
        }
        .section-label {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin: 0 0 10px;
        }
        .calendar-row {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 500;
          color: #1f2937;
        }
        .calendar-dot {
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: linear-gradient(135deg,#3b82f6,#6366f1);
          flex-shrink: 0;
        }

        .tips-card {
          margin-top: auto;
          background: linear-gradient(135deg,#eff6ff,#eef2ff);
          border: 1px solid #dbeafe;
          border-radius: 14px;
          padding: 14px 16px;
        }
        .tips-title {
          font-size: 12.5px;
          font-weight: 600;
          color: #1e40af;
          margin: 0 0 6px;
        }
        .tips-text {
          font-size: 12px;
          color: #475569;
          margin: 0;
        }
        .tips-example {
          font-size: 12px;
          color: #1e40af;
          font-weight: 500;
          margin: 4px 0 0;
        }
      `}</style>
    </div>
  );
}
