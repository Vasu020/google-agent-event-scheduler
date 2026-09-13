"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DatesSetArg, EventClickArg, EventDropArg } from "@fullcalendar/core";
import type { DateClickArg, EventResizeDoneArg } from "@fullcalendar/interaction";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { CalendarEvent } from "@/app/agents/tools/gcal/client";

/** Local YYYY-MM-DD for the grid boundary FullCalendar reports (not UTC — avoids day-shift near midnight). */
function toDateStr(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function CalendarView({
  selectedDate,
  events,
  onDateSelect,
  onEventSelect,
  onRefresh,
  onRangeChange,
}: {
  selectedDate: Date;
  events: CalendarEvent[];
  onDateSelect?: (date: Date) => void;
  onEventSelect?: (event: CalendarEvent) => void;
  onRefresh?: () => void;
  onRangeChange?: (from: string, to: string) => void;
}) {
  const calendarRef = useRef<FullCalendar>(null);

  // Sync sidebar date with full calendar
  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.gotoDate(selectedDate);
    }
  }, [selectedDate]);

  const handleDateClick = (info: DateClickArg) => {
    onDateSelect?.(info.date);
  };

  const handleDatesSet = (info: DatesSetArg) => {
    onRangeChange?.(toDateStr(info.start), toDateStr(info.end));
  };

  const handleEventClick = (info: EventClickArg) => {
    onEventSelect?.({
      id: info.event.id,
      title: info.event.title,
      start: info.event.startStr,
      end: info.event.endStr,
      description: info.event.extendedProps?.description,
    });
  };

  // Persist a drag/resize back to Google Calendar; roll back on failure
  const persistMove = async (info: EventDropArg | EventResizeDoneArg) => {
    try {
      const res = await fetch(`/api/events/${info.event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: info.event.startStr,
          end: info.event.endStr,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to move event.");
      toast.success(`"${info.event.title}" moved`);
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move event.");
      info.revert();
    }
  };

  return (
    <div className="calendar-card h-full flex-1">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        events={events.map((e) => ({ ...e }))}
        dateClick={handleDateClick}
        datesSet={handleDatesSet}
        eventClick={handleEventClick}
        eventDrop={persistMove}
        eventResize={persistMove}
        editable={true}
        selectable={true}
        selectMirror={true}
        height="100%"
        nowIndicator={true}
        slotMinTime="07:00:00"
        slotMaxTime="23:00:00"
        eventDisplay="block"
      />

      <style>{`
        .calendar-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.06);
          padding: 16px;
          overflow: hidden;
        }
        .calendar-card .fc {
          font-family: inherit;
        }
        .calendar-card .fc-toolbar-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: #1f2937;
        }
        .calendar-card .fc-button-primary {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          color: #334155;
          text-transform: capitalize;
          box-shadow: none;
          font-weight: 500;
        }
        .calendar-card .fc-button-primary:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #1e293b;
        }
        .calendar-card .fc-button-primary:not(:disabled).fc-button-active,
        .calendar-card .fc-button-primary:not(:disabled):active {
          background: linear-gradient(135deg,#2563eb,#3b82f6);
          border-color: transparent;
          color: #fff;
        }
        .calendar-card .fc-today-button {
          text-transform: capitalize;
        }
        .calendar-card .fc-col-header-cell {
          background: #f8fafc;
        }
        .calendar-card .fc-col-header-cell-cushion {
          color: #64748b;
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          padding: 8px 4px;
        }
        .calendar-card .fc-day-today {
          background: rgba(59,130,246,0.06) !important;
        }
        .calendar-card .fc-event {
          border: none;
          border-radius: 8px;
          padding: 2px 6px;
          font-size: 0.8rem;
          font-weight: 500;
          background: linear-gradient(135deg,#2563eb,#3b82f6);
          box-shadow: 0 2px 6px rgba(59,130,246,0.25);
          cursor: pointer;
        }
        .calendar-card .fc-event:hover {
          filter: brightness(1.05);
        }
        .calendar-card .fc-timegrid-now-indicator-line {
          border-color: #ef4444;
        }
        .calendar-card .fc-timegrid-now-indicator-arrow {
          border-color: #ef4444;
          color: #ef4444;
        }
        .calendar-card a {
          text-decoration: none;
        }
      `}</style>
    </div>
  );
}
