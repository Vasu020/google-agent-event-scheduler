"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { useState } from "react";
import { EventModal } from "./EventModal";

interface SidebarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export function Sidebar({ selectedDate, onDateSelect }: SidebarProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="w-72 border-r bg-white p-5 flex flex-col gap-6">
      {/* Quick Add Button - Redesigned */}
      <Button
        onClick={() => setIsModalOpen(true)}
        className="w-full h-12 text-base font-medium gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md"
      >
        <Plus className="h-5 w-5" />
        Quick Add Event
      </Button>

      {/* Mini Calendar */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Calendar</span>
        </div>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && onDateSelect(date)}
          className="rounded-xl border shadow-sm"
          classNames={{
            day_selected: "bg-blue-600 text-white hover:bg-blue-600",
            day_today: "text-blue-600 font-semibold",
          }}
        />
      </div>

      {/* Tips */}
      <div className="text-xs text-muted-foreground bg-muted/50 p-4 rounded-xl">
        <p className="font-medium mb-1">💡 Quick Tips</p>
        <p>Try typing natural language in chat:</p>
        <p className="mt-1">"Meeting with team tomorrow at 3pm"</p>
      </div>

      <EventModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        defaultDate={selectedDate}
      />
    </div>
  );
}