"use client";

import { useMemo, useState } from "react";
import { format, startOfWeek, addDays, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeetingsCalendarView } from "@/components/meetings/meetings-calendar-view";
import { TimeGrid } from "@/components/calendar/time-grid";
import type { Meeting } from "@/lib/types";

type ViewMode = "day" | "week" | "month";

export function CalendarView({ meetings }: { meetings: Meeting[] }) {
  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(new Date());

  const weekDays = useMemo(() => {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor]);

  function shift(dir: 1 | -1) {
    if (view === "day") setAnchor((prev) => addDays(prev, dir));
    else if (view === "week") setAnchor((prev) => addDays(prev, dir * 7));
    else setAnchor((prev) => (dir === 1 ? addMonths(prev, 1) : subMonths(prev, 1)));
  }

  const title =
    view === "day"
      ? format(anchor, "MMMM d, yyyy")
      : view === "week"
        ? `${format(weekDays[0], "MMM d")} – ${format(weekDays[6], "MMM d, yyyy")}`
        : format(anchor, "MMMM yyyy");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
          <div className="flex items-center">
            <Button size="icon" variant="ghost" onClick={() => shift(-1)} aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => shift(1)} aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
        </div>

        <div className="flex items-center gap-1 rounded-control border border-border bg-white p-1">
          {(["day", "week", "month"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                view === v ? "bg-primary/10 text-primary" : "text-muted-foreground"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "month" && <MeetingsCalendarView meetings={meetings} month={anchor} hideHeader />}
      {view === "week" && <TimeGrid days={weekDays} meetings={meetings} />}
      {view === "day" && <TimeGrid days={[anchor]} meetings={meetings} />}
    </div>
  );
}
