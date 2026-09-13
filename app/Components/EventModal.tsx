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
import { CalendarIcon, Clock, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { CalendarEvent } from "@/app/agents/tools/gcal/client";

interface EventModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultDate?: Date;
    event?: CalendarEvent | null;
    onSaved?: () => void;
}

/** "2026-08-28T14:00:00+05:30" → { date: "2026-08-28", time: "14:00" } */
function splitISTDateTime(iso: string) {
    const [datePart, timePart] = iso.split("T");
    return { date: datePart, time: (timePart ?? "09:00").slice(0, 5) };
}

function toISTDateTime(date: Date, time: string) {
    return `${format(date, "yyyy-MM-dd")}T${time}:00+05:30`;
}

function seedFromEvent(event: CalendarEvent) {
    const { date: sDate, time: sTime } = splitISTDateTime(event.start);
    const { time: eTime } = splitISTDateTime(event.end || event.start);
    return {
        title: event.title ?? "",
        date: new Date(`${sDate}T00:00:00`),
        startTime: sTime,
        endTime: eTime,
        description: event.description ?? "",
    };
}

function seedForCreate(defaultDate?: Date) {
    return {
        title: "",
        date: defaultDate || new Date(),
        startTime: "09:00",
        endTime: "10:00",
        description: "",
    };
}

/**
 * Owns the form fields for one open instance of the modal. Remounted (via
 * `key` in EventModal) every time the dialog opens for a new event/date, so
 * state is seeded once per instance instead of synced through an effect.
 */
function EventForm({
    event,
    defaultDate,
    onOpenChange,
    onSaved,
}: {
    event?: CalendarEvent | null;
    defaultDate?: Date;
    onOpenChange: (open: boolean) => void;
    onSaved?: () => void;
}) {
    const isEdit = !!event;
    const seed = event ? seedFromEvent(event) : seedForCreate(defaultDate);

    const [title, setTitle] = useState(seed.title);
    const [date, setDate] = useState<Date>(seed.date);
    const [startTime, setStartTime] = useState(seed.startTime);
    const [endTime, setEndTime] = useState(seed.endTime);
    const [description, setDescription] = useState(seed.description);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleSave = async () => {
        if (!title.trim() || saving || deleting) return;

        const start = toISTDateTime(date, startTime);
        const end = toISTDateTime(date, endTime);
        if (new Date(start) >= new Date(end)) {
            toast.error("End time must be after start time.");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch(isEdit ? `/api/events/${event!.id}` : "/api/events", {
                method: isEdit ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim(),
                    start,
                    end,
                    description: description.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Request failed.");

            toast.success(isEdit ? "Event updated" : "Event created");
            onOpenChange(false);
            onSaved?.();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!event || saving || deleting) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Request failed.");

            toast.success("Event deleted");
            onOpenChange(false);
            onSaved?.();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setDeleting(false);
        }
    };

    const busy = saving || deleting;

    return (
        <DialogContent className="sm:max-w-md !rounded-2xl p-0 overflow-hidden gap-0">
            <DialogHeader className="flex-row items-center gap-3 border-b px-6 pt-6 pb-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                    <CalendarIcon className="h-5 w-5" />
                </div>
                <div className="flex flex-col gap-0.5">
                    <DialogTitle className="text-lg font-semibold text-foreground">
                        {isEdit ? "Edit Event" : "New Event"}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        {isEdit ? "Update the details below" : "Add it to your calendar"}
                    </p>
                </div>
            </DialogHeader>

            <div className="space-y-5 px-6 py-5">
                <div>
                    <Label htmlFor="title" className="text-sm font-medium text-foreground">
                        Event title
                    </Label>
                    <Input
                        id="title"
                        placeholder="Team Sync Meeting"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="mt-1.5 h-11 text-base"
                        autoFocus
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label className="text-sm font-medium text-foreground">Date</Label>
                        <Popover>
                            <PopoverTrigger
                                render={
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-left font-normal mt-1.5 h-11 text-sm"
                                    />
                                }
                            >
                                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                {format(date, "PPP")}
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div>
                        <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            Time
                        </Label>
                        <div className="flex items-center gap-2 mt-1.5">
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="flex-1 h-11 rounded-lg border border-input bg-background px-2 text-sm text-center"
                                style={{ colorScheme: "light" }}
                            />
                            <span className="text-muted-foreground text-sm">–</span>
                            <input
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="flex-1 h-11 rounded-lg border border-input bg-background px-2 text-sm text-center"
                                style={{ colorScheme: "light" }}
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <Label htmlFor="desc" className="text-sm font-medium text-foreground">
                        Description <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Textarea
                        id="desc"
                        placeholder="Discuss Q3 goals and roadmap..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="mt-1.5 text-sm min-h-[88px] resize-none"
                    />
                </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 bg-muted/40 border-t">
                {isEdit ? (
                    <Button variant="destructive" onClick={handleDelete} disabled={busy} className="gap-2">
                        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Delete
                    </Button>
                ) : (
                    <span />
                )}

                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!title.trim() || busy}
                        className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isEdit ? "Save changes" : "Create event"}
                    </Button>
                </div>
            </div>
        </DialogContent>
    );
}

export function EventModal({ open, onOpenChange, defaultDate, event, onSaved }: EventModalProps) {
    // Bump instanceKey exactly when `open` flips false→true, so EventForm
    // remounts (and re-seeds its fields) fresh each time the dialog opens —
    // no effect-based state sync needed.
    const [prevOpen, setPrevOpen] = useState(open);
    const [instanceKey, setInstanceKey] = useState(0);
    if (open !== prevOpen) {
        setPrevOpen(open);
        if (open) setInstanceKey((k) => k + 1);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <EventForm
                key={instanceKey}
                event={event}
                defaultDate={defaultDate}
                onOpenChange={onOpenChange}
                onSaved={onSaved}
            />
        </Dialog>
    );
}
