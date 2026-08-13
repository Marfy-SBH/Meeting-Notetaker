import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { Meeting } from "@/lib/types";

// This app serves a single-timezone (Bangladesh) team. All display
// formatting is anchored to this zone regardless of where the server
// process happens to run — Vercel defaults to UTC, and without this,
// every displayed meeting time and every reminder firing time would
// silently shift depending on the deployment's ambient timezone.
export const APP_TIMEZONE = "Asia/Dhaka";

export function meetingDateTime(m: Meeting): Date {
  if (m.started_at) return new Date(m.started_at);
  if (m.scheduled_date) {
    const time = m.scheduled_start_time ?? "00:00:00";
    // `timezone` is the zone the meeting was actually scheduled in (captured
    // from the scheduler's browser at schedule time) — parsing the
    // wall-clock string against that zone, not the runtime's ambient one,
    // is what makes this produce the correct absolute instant everywhere.
    return fromZonedTime(`${m.scheduled_date}T${time}`, m.timezone || APP_TIMEZONE);
  }
  return new Date(m.created_at);
}

export function meetingEndDateTime(m: Meeting): Date {
  const start = meetingDateTime(m);
  if (m.ended_at) return new Date(m.ended_at);
  if (m.duration != null) return new Date(start.getTime() + m.duration * 1000);
  if (m.scheduled_date && m.scheduled_end_time) {
    return fromZonedTime(`${m.scheduled_date}T${m.scheduled_end_time}`, m.timezone || APP_TIMEZONE);
  }
  return new Date(start.getTime() + 30 * 60 * 1000);
}

// Format an absolute-instant Date for display, always in the app's
// timezone — never the server/browser's ambient one. Use this (not
// date-fns's plain `format`) for anything shown to the user: meeting
// times, notification timestamps, transcript segment clock times, etc.
export function formatInAppTz(date: Date, formatStr: string): string {
  return formatInTimeZone(date, APP_TIMEZONE, formatStr);
}

function dateKeyInAppTz(date: Date): string {
  return formatInAppTz(date, "yyyy-MM-dd");
}

export function dateGroupLabel(date: Date): string {
  const key = dateKeyInAppTz(date);
  if (key === dateKeyInAppTz(new Date())) return "Today";
  // Bangladesh has no DST, so a flat 24h subtraction is exact.
  if (key === dateKeyInAppTz(new Date(Date.now() - 86_400_000))) return "Yesterday";
  return formatInAppTz(date, "MMMM d");
}

export function groupMeetingsByDate<T extends Meeting>(meetings: T[]): { label: string; date: Date; items: T[] }[] {
  const groups = new Map<string, { label: string; date: Date; items: T[] }>();
  for (const m of meetings) {
    const dt = meetingDateTime(m);
    const key = dateKeyInAppTz(dt);
    if (!groups.has(key)) groups.set(key, { label: dateGroupLabel(dt), date: dt, items: [] });
    groups.get(key)!.items.push(m);
  }
  return Array.from(groups.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function isUpcoming(m: Meeting): boolean {
  if (m.status === "completed" || m.status === "cancelled" || m.status === "failed") return false;
  return meetingDateTime(m).getTime() > Date.now();
}

// Day/week/month boundary helpers, all anchored to APP_TIMEZONE rather than
// the runtime's ambient timezone. Deliberately avoid date-fns's local-getter
// arithmetic (startOfDay/startOfWeek/etc.) entirely — those read the
// runtime's own local calendar fields, which is exactly the ambient-tz trap
// this module exists to avoid. Date.UTC() below is used purely as a
// proleptic-Gregorian calendar calculator (day-of-week, adding/subtracting
// days), never as a real instant — every day is treated as an exact 24h span,
// which is safe because Asia/Dhaka observes no DST.
function ymdInAppTz(date: Date): { y: number; m: number; d: number } {
  const [y, m, d] = formatInAppTz(date, "yyyy-MM-dd").split("-").map(Number);
  return { y, m, d };
}

function startOfDayFromYmd(y: number, m: number, d: number): Date {
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return fromZonedTime(`${pad(y, 4)}-${pad(m)}-${pad(d)}T00:00:00.000`, APP_TIMEZONE);
}

export function startOfDayInAppTz(date: Date): Date {
  const { y, m, d } = ymdInAppTz(date);
  return startOfDayFromYmd(y, m, d);
}

export function endOfDayInAppTz(date: Date): Date {
  return new Date(startOfDayInAppTz(date).getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function daysAgoInAppTz(date: Date, n: number): Date {
  const { y, m, d } = ymdInAppTz(date);
  const calc = new Date(Date.UTC(y, m - 1, d - n));
  return startOfDayFromYmd(calc.getUTCFullYear(), calc.getUTCMonth() + 1, calc.getUTCDate());
}

export function startOfWeekInAppTz(date: Date): Date {
  const { y, m, d } = ymdInAppTz(date);
  const calc = new Date(Date.UTC(y, m - 1, d));
  calc.setUTCDate(calc.getUTCDate() - calc.getUTCDay()); // back up to Sunday
  return startOfDayFromYmd(calc.getUTCFullYear(), calc.getUTCMonth() + 1, calc.getUTCDate());
}

export function endOfWeekInAppTz(date: Date): Date {
  return new Date(startOfWeekInAppTz(date).getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
}

export function startOfMonthInAppTz(date: Date): Date {
  const { y, m } = ymdInAppTz(date);
  return startOfDayFromYmd(y, m, 1);
}

// Minutes since local midnight in APP_TIMEZONE — for positioning events on
// an hour grid whose row labels are timezone-agnostic ("9 AM", "10 AM", ...).
// Using the runtime's ambient getters (date.getHours()) here would place
// events at the wrong row whenever the server's ambient tz isn't Dhaka.
export function minutesSinceMidnightInAppTz(date: Date): number {
  const [h, m] = formatInAppTz(date, "HH:mm").split(":").map(Number);
  return h * 60 + m;
}

export function endOfMonthInAppTz(date: Date): Date {
  const { y, m } = ymdInAppTz(date);
  const lastDay = new Date(Date.UTC(y, m, 0)); // day 0 of next month = last day of this month
  return endOfDayInAppTz(startOfDayFromYmd(lastDay.getUTCFullYear(), lastDay.getUTCMonth() + 1, lastDay.getUTCDate()));
}
