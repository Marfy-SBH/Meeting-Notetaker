"use client";

import Link from "next/link";
import { format, isSameDay, isToday } from "date-fns";
import { StatusBadge } from "@/components/meetings/status-badge";
import { meetingDateTime, meetingEndDateTime } from "@/lib/meeting-grouping";
import { layoutDayEvents } from "@/lib/calendar-layout";
import { cn } from "@/lib/utils";
import type { Meeting } from "@/lib/types";

const HOUR_HEIGHT = 80;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function TimeGrid({ days, meetings }: { days: Date[]; meetings: Meeting[] }) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const byDay = days.map((day) => {
    const dayMeetings = meetings.filter((m) => isSameDay(meetingDateTime(m), day));
    const events = layoutDayEvents(
      dayMeetings.map((m) => ({ id: m.id, start: meetingDateTime(m), end: meetingEndDateTime(m) }))
    );
    return { day, events, meetingsById: new Map(dayMeetings.map((m) => [m.id, m])) };
  });

  return (
    <div className="rounded-card border border-border bg-card">
      <div className="flex border-b border-border">
        <div className="w-14 shrink-0" />
        {days.map((day) => (
          <div key={day.toISOString()} className="flex-1 border-l border-border py-2 text-center">
            <p className="text-xs text-muted-foreground">{format(day, "EEE")}</p>
            <p
              className={cn(
                "mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                isToday(day) ? "bg-primary text-white" : "text-foreground"
              )}
            >
              {format(day, "d")}
            </p>
          </div>
        ))}
      </div>

      <div className="relative max-h-[720px] overflow-y-auto">
        <div className="flex">
          <div className="w-14 shrink-0">
            {HOURS.map((h) => (
              <div key={h} style={{ height: HOUR_HEIGHT }} className="relative">
                <span className="absolute -top-2 right-2 text-[11px] text-muted-foreground">
                  {h === 0 ? "" : format(new Date(2000, 0, 1, h), "h a")}
                </span>
              </div>
            ))}
          </div>

          {byDay.map(({ day, events, meetingsById }) => (
            <div key={day.toISOString()} className="relative flex-1 border-l border-border">
              {HOURS.map((h) => (
                <div key={h} style={{ height: HOUR_HEIGHT }} className="border-b border-border/60" />
              ))}

              {isToday(day) && (
                <div
                  className="absolute inset-x-0 z-10 h-px bg-danger"
                  style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
                >
                  <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-danger" />
                </div>
              )}

              {events.map((e) => {
                const meeting = meetingsById.get(e.id);
                if (!meeting) return null;
                const startMinutes = e.start.getHours() * 60 + e.start.getMinutes();
                const durationMinutes = Math.max(30, (e.end.getTime() - e.start.getTime()) / 60000);
                const width = 100 / e.colCount;

                return (
                  <Link
                    key={e.id}
                    href={`/meetings/${meeting.id}`}
                    className="absolute z-[5] overflow-hidden rounded-md border-l-2 border-primary bg-primary/10 px-1.5 py-0.5 text-left hover:bg-primary/20"
                    style={{
                      top: (startMinutes / 60) * HOUR_HEIGHT,
                      height: (durationMinutes / 60) * HOUR_HEIGHT,
                      left: `${e.col * width}%`,
                      width: `${width}%`,
                    }}
                  >
                    <p className="truncate text-[11px] font-medium text-primary">{format(e.start, "h:mm a")}</p>
                    <p className="truncate text-xs font-medium text-foreground">{meeting.title}</p>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
