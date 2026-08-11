import { isToday, isYesterday, format } from "date-fns";
import type { Meeting } from "@/lib/types";

export function meetingDateTime(m: Meeting): Date {
  if (m.started_at) return new Date(m.started_at);
  if (m.scheduled_date) {
    const time = m.scheduled_start_time ?? "00:00:00";
    return new Date(`${m.scheduled_date}T${time}`);
  }
  return new Date(m.created_at);
}

export function meetingEndDateTime(m: Meeting): Date {
  const start = meetingDateTime(m);
  if (m.ended_at) return new Date(m.ended_at);
  if (m.duration != null) return new Date(start.getTime() + m.duration * 1000);
  if (m.scheduled_date && m.scheduled_end_time) {
    return new Date(`${m.scheduled_date}T${m.scheduled_end_time}`);
  }
  return new Date(start.getTime() + 30 * 60 * 1000);
}

export function dateGroupLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d");
}

export function groupMeetingsByDate<T extends Meeting>(meetings: T[]): { label: string; date: Date; items: T[] }[] {
  const groups = new Map<string, { label: string; date: Date; items: T[] }>();
  for (const m of meetings) {
    const dt = meetingDateTime(m);
    const key = format(dt, "yyyy-MM-dd");
    if (!groups.has(key)) groups.set(key, { label: dateGroupLabel(dt), date: dt, items: [] });
    groups.get(key)!.items.push(m);
  }
  return Array.from(groups.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function isUpcoming(m: Meeting): boolean {
  if (m.status === "completed" || m.status === "cancelled" || m.status === "failed") return false;
  return meetingDateTime(m).getTime() > Date.now();
}
