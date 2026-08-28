"use client";

import { useState } from "react";
import { CalendarView } from "./Components/CalendarView";
import { ChatPanel } from "./Components/ChatPanel";
import { Sidebar } from "./Components/Sidebar";


export default function Home() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<any[]>([]);


  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar (30px wide on large screens) */}
      <Sidebar selectedDate={selectedDate} onDateSelect={setSelectedDate} />

      {/* Main content: Calendar + Chat */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 overflow-hidden">
          {/* Calendar takes 70% */}
          <div className="w-3/4 p-4 overflow-auto border-r">
            <CalendarView selectedDate={selectedDate} events={events} />
          </div>
          {/* Chat panel takes 30% */}
          <div className="w-1/4 flex flex-col">
            <ChatPanel onEventsChange={setEvents} />
          </div>
        </div>
      </div>
    </div>
  );
}