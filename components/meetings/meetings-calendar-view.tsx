"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isSameMonth,
  isSameDay,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { meetingDateTime } from "@/lib/meeting-grouping";
import type { Meeting } from "@/lib/types";

export function MeetingsCalendarView({
  meetings,
  month: controlledMonth,
  hideHeader = false,
}: {
  meetings: Meeting[];
  month?: Date;
  hideHeader?: boolean;
}) {
  const [internalMonth, setInternalMonth] = useState(new Date());
  const month = controlledMonth ?? internalMonth;

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    const arr: Date[] = [];
    let d = start;
    while (d <= end) {
      arr.push(d);
      d = addDays(d, 1);
    }
    return arr;
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of meetings) {
      const key = format(meetingDateTime(m), "yyyy-MM-dd");
      (map.get(key) ?? map.set(key, []).get(key)!).push(m);
    }
    return map;
  }, [meetings]);

  return (
    <div className="rounded-card border border-border bg-card">
      {!hideHeader && (
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">{format(month, "MMMM yyyy")}</h3>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => setInternalMonth(addDays(startOfMonth(month), -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setInternalMonth(addDays(endOfMonth(month), 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-7 border-b border-border text-center text-xs font-medium text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const items = byDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={`min-h-[92px] border-b border-r border-border p-2 ${
                isSameMonth(day, month) ? "" : "bg-gray-50/60 text-muted-foreground/60"
              }`}
            >
              <span
                className={`text-xs ${
                  isSameDay(day, new Date()) ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary font-semibold text-white" : ""
                }`}
              >
                {format(day, "d")}
              </span>
              <div className="mt-1 flex flex-col gap-1">
                {items.slice(0, 2).map((m) => (
                  <Link
                    key={m.id}
                    href={`/meetings/${m.id}`}
                    className="block truncate rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20"
                  >
                    {m.title}
                  </Link>
                ))}
                {items.length > 2 && (
                  <span className="text-[11px] text-muted-foreground">+{items.length - 2} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
