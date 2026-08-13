"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function to24Hour(hour12: number, minute: number, meridiem: "AM" | "PM") {
  const hour24 = meridiem === "AM" ? (hour12 === 12 ? 0 : hour12) : hour12 === 12 ? 12 : hour12 + 12;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function from24Hour(value: string) {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const meridiem: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { hour12, minute: m, meridiem };
}

const selectClass =
  "h-9 rounded-control border border-border bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

export function TimePicker({
  name,
  defaultValue,
  required,
  className,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
}) {
  const parsed = defaultValue ? from24Hour(defaultValue) : null;
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState<number | null>(parsed?.hour12 ?? null);
  const [minute, setMinute] = useState<number | null>(parsed?.minute ?? null);
  const [meridiem, setMeridiem] = useState<"AM" | "PM" | null>(parsed?.meridiem ?? null);
  const touched = useRef({ hour: false, minute: false, meridiem: false });

  useEffect(() => {
    // Fields that already have a value (e.g. editing an existing time) count
    // as already "chosen" — otherwise editing just one field would require
    // re-picking all three before the popover would auto-close again.
    if (open) touched.current = { hour: hour != null, minute: minute != null, meridiem: meridiem != null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const checkAllTouched = () => {
    if (touched.current.hour && touched.current.minute && touched.current.meridiem) setOpen(false);
  };

  const value = hour != null && minute != null && meridiem ? to24Hour(hour, minute, meridiem) : "";
  const label =
    hour != null && minute != null && meridiem
      ? `${hour}:${String(minute).padStart(2, "0")} ${meridiem}`
      : "Select time";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <input type="hidden" name={name} value={value} required={required} />
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-control border border-border bg-white px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            hour == null && "text-muted-foreground",
            className
          )}
        >
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto">
        <div className="flex items-center gap-2">
          <select
            className={selectClass}
            value={hour ?? ""}
            onChange={(e) => {
              setHour(Number(e.target.value));
              touched.current.hour = true;
              checkAllTouched();
            }}
          >
            <option value="" disabled>
              HH
            </option>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <span className="text-muted-foreground">:</span>
          <select
            className={selectClass}
            value={minute ?? ""}
            onChange={(e) => {
              setMinute(Number(e.target.value));
              touched.current.minute = true;
              checkAllTouched();
            }}
          >
            <option value="" disabled>
              MM
            </option>
            {MINUTES.map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, "0")}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={meridiem ?? ""}
            onChange={(e) => {
              setMeridiem(e.target.value as "AM" | "PM");
              touched.current.meridiem = true;
              checkAllTouched();
            }}
          >
            <option value="" disabled>
              AM
            </option>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
