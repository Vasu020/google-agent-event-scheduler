"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

interface EventModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultDate?: Date;
    onSave?: (event: any) => void;
}

export function EventModal({ open, onOpenChange, defaultDate, onSave }: EventModalProps) {
    const [title, setTitle] = useState("");
    const [date, setDate] = useState<Date>(defaultDate || new Date());
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("10:00");
    const [description, setDescription] = useState("");

    const handleSave = () => {
        if (!title.trim()) return;

        const startDateTime = new Date(date);
        const [startHour, startMin] = startTime.split(":").map(Number);
        startDateTime.setHours(startHour, startMin);

        const endDateTime = new Date(date);
        const [endHour, endMin] = endTime.split(":").map(Number);
        endDateTime.setHours(endHour, endMin);

        const newEvent = {
            id: Date.now().toString(),
            title: title.trim(),
            start: startDateTime.toISOString(),
            end: endDateTime.toISOString(),
            description: description.trim(),
            allDay: false,
        };

        onSave?.(newEvent);
        onOpenChange(false);

        setTitle("");
        setDescription("");
        setStartTime("09:00");
        setEndTime("10:00");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-semibold">Create New Event</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    <div>
                        <Label htmlFor="title" className="text-base font-medium">Event Title</Label>
                        <Input
                            id="title"
                            placeholder="Team Sync Meeting"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="mt-2 text-base py-3"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {/* Date */}
                        <div>
                            <Label className="text-base font-medium">Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-left font-normal mt-2 h-10 text-sm"
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {format(date, "PPP")}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Time - Clean Fix */}
                        <div>
                            <Label className="text-base font-medium">Time</Label>
                            <div className="flex items-center gap-3 mt-2">
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-center appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden"
                                    style={{ colorScheme: 'light' }}
                                />
                                <span className="text-muted-foreground text-sm">–</span>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-center appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden"
                                    style={{ colorScheme: 'light' }}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="desc" className="text-base font-medium">Description (optional)</Label>
                        <Textarea
                            id="desc"
                            placeholder="Discuss Q3 goals and roadmap..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="mt-2 text-base py-3 min-h-[100px]"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="px-6 py-6 text-base">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!title.trim()}
                        className="px-8 py-6 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    >
                        Create Event
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}