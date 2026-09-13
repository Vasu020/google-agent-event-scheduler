"use client";

import { useCallback, useRef, useState } from "react";
import { CalendarView } from "./Components/CalendarView";
import { ChatPanel } from "./Components/ChatPanel";
import { Sidebar } from "./Components/Sidebar";
import { EventModal } from "./Components/EventModal";
import type { CalendarEvent } from "./agents/tools/gcal/client";

export default function Home() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<Date | undefined>(undefined);
  const [modalEvent, setModalEvent] = useState<CalendarEvent | null>(null);

  // The calendar's own "upcoming only" fetch would miss earlier-today/past
  // events within the visible week or month, so we always fetch by the
  // date range CalendarView is actually showing (reported via onRangeChange).
  const rangeRef = useRef<{ from: string; to: string } | null>(null);

  const fetchEventsForRange = useCallback((from: string, to: string) => {
    fetch(`/api/events?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.events) setEvents(data.events);
      })
      .catch((err) => console.error("[Home] events fetch failed:", err));
  }, []);

  const handleRangeChange = useCallback(
    (from: string, to: string) => {
      rangeRef.current = { from, to };
      fetchEventsForRange(from, to);
    },
    [fetchEventsForRange],
  );

  const refreshEvents = useCallback(() => {
    if (rangeRef.current) fetchEventsForRange(rangeRef.current.from, rangeRef.current.to);
  }, [fetchEventsForRange]);

  const openCreateModal = (date?: Date) => {
    setModalEvent(null);
    setModalDate(date ?? selectedDate);
    setModalOpen(true);
  };

  const openEditModal = (event: CalendarEvent) => {
    setModalEvent(event);
    setModalDate(undefined);
    setModalOpen(true);
  };

  return (
    <div className="flex h-screen overflow-x-auto overflow-y-hidden">
      <Sidebar
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        onCreateClick={() => openCreateModal()}
      />

      {/* Main content: Calendar + Chat */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-[820px]">
        <div className="flex flex-1 overflow-hidden">
          {/* Calendar grows to fill remaining space, never below a usable width */}
          <div className="flex-1 min-w-[440px] p-4 overflow-auto border-r">
            <CalendarView
              selectedDate={selectedDate}
              events={events}
              onDateSelect={openCreateModal}
              onEventSelect={openEditModal}
              onRefresh={refreshEvents}
              onRangeChange={handleRangeChange}
            />
          </div>
          {/* Chat panel: fixed width so it never gets crushed illegibly */}
          <div className="w-[380px] shrink-0 flex flex-col">
            <ChatPanel onEventsChange={refreshEvents} />
          </div>
        </div>
      </div>

      <EventModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        defaultDate={modalDate}
        event={modalEvent}
        onSaved={refreshEvents}
      />
    </div>
  );
}
