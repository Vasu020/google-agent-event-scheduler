"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useEffect, useRef } from "react";

export function CalendarView({
  selectedDate,
  events,
  onEventsChange
}: {
  selectedDate: Date;
  events: any[];
  onEventsChange?: (events: any[]) => void;
}) {
  const calendarRef = useRef<any>(null);

  // Sync sidebar date with full calendar
  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.gotoDate(selectedDate);
    }
  }, [selectedDate]);

  const handleDateClick = (info: any) => {
    // You can open EventModal here too
    alert(`Selected: ${info.dateStr}`);
  };

  const handleEventClick = (info: any) => {
    alert(`Event clicked: ${info.event.title}\n\n${info.event.extendedProps.description || ""}`);
    // TODO: Open edit modal
  };

  const handleEventDrop = (info: any) => {
    // Update event in your state
    console.log("Event moved:", info.event);
  };

  return (
    <div className="h-full flex-1">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        events={events}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        editable={true}
        selectable={true}
        selectMirror={true}
        height="100%"
        nowIndicator={true}
        slotMinTime="07:00:00"
        slotMaxTime="23:00:00"
      />
    </div>
  );
}