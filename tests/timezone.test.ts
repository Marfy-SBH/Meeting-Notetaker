import { describe, it, expect } from "vitest";
import {
  meetingDateTime,
  isUpcoming,
  formatInAppTz,
  startOfDayInAppTz,
  endOfDayInAppTz,
  startOfWeekInAppTz,
} from "@/lib/meeting-grouping";
import type { Meeting } from "@/lib/types";

// Regression test for Priority 2. Deliberately forces the process's ambient
// timezone to UTC (what Vercel defaults to) to reproduce the exact
// production failure mode: this dev sandbox happens to run in Asia/Dhaka,
// which was masking the bug locally. If this test is ever run somewhere
// that ignores process.env.TZ, the assertions below would fail loudly
// rather than silently pass for the wrong reason.
process.env.TZ = "UTC";

function baseMeeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: "m1",
    workspace_id: "w1",
    title: "Test meeting",
    platform: "in_app",
    meeting_link: null,
    status: "scheduled",
    scheduled_date: null,
    scheduled_start_time: null,
    scheduled_end_time: null,
    timezone: "Asia/Dhaka",
    reminder_minutes: 15,
    reminder_sent: false,
    started_at: null,
    ended_at: null,
    duration: null,
    recording_url: null,
    audio_deleted_at: null,
    created_by: "u1",
    processing_step: null,
    processing_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("timezone handling (process.env.TZ = UTC)", () => {
  it("a meeting scheduled for 10:00 AM Dhaka time is an absolute instant of 04:00 UTC", () => {
    const meeting = baseMeeting({
      scheduled_date: "2026-06-15",
      scheduled_start_time: "10:00:00",
      timezone: "Asia/Dhaka",
    });

    const dt = meetingDateTime(meeting);
    // Dhaka is UTC+6 with no DST, so 10:00 Dhaka = 04:00 UTC, always.
    expect(dt.toISOString()).toBe("2026-06-15T04:00:00.000Z");
  });

  it("displays that same meeting as 10:00 AM regardless of the server's ambient timezone", () => {
    const meeting = baseMeeting({
      scheduled_date: "2026-06-15",
      scheduled_start_time: "10:00:00",
      timezone: "Asia/Dhaka",
    });

    const dt = meetingDateTime(meeting);
    // formatInAppTz must show Dhaka wall-clock time even though this
    // process's ambient TZ is forced to UTC above.
    expect(formatInAppTz(dt, "h:mm a")).toBe("10:00 AM");
  });

  it("a meeting scheduled 5 minutes from now (Dhaka time) is upcoming, not misjudged as past due to ambient UTC", () => {
    // Build "5 minutes from now" as a Dhaka wall-clock date/time string.
    const nowInDhaka = formatInAppTz(new Date(Date.now() + 5 * 60_000), "yyyy-MM-dd'T'HH:mm:ss");
    const [date, time] = nowInDhaka.split("T");
    const meeting = baseMeeting({ scheduled_date: date, scheduled_start_time: time, timezone: "Asia/Dhaka" });

    expect(isUpcoming(meeting)).toBe(true);
  });

  it("reminder-firing math (mirrors sendMeetingReminders) fires within the correct Dhaka-local window, not shifted by 6 hours", () => {
    // Meeting starts in 10 minutes (Dhaka time); reminder is set for 15
    // minutes before start — so a reminder should be due right now.
    const startInstant = new Date(Date.now() + 10 * 60_000);
    const [date, time] = formatInAppTz(startInstant, "yyyy-MM-dd'T'HH:mm:ss").split("T");
    const meeting = baseMeeting({
      scheduled_date: date,
      scheduled_start_time: time,
      timezone: "Asia/Dhaka",
      reminder_minutes: 15,
    });

    const startTime = meetingDateTime(meeting).getTime();
    const reminderAt = startTime - (meeting.reminder_minutes ?? 15) * 60_000;
    const now = Date.now();

    expect(now).toBeGreaterThanOrEqual(reminderAt);
    expect(now).toBeLessThan(startTime);
  });

  it("day/week boundaries are anchored to Dhaka's calendar, not UTC's", () => {
    const now = new Date();
    const start = startOfDayInAppTz(now);
    const end = endOfDayInAppTz(now);

    // The whole [start, end] span must format as the same Dhaka calendar day.
    expect(formatInAppTz(start, "yyyy-MM-dd")).toBe(formatInAppTz(end, "yyyy-MM-dd"));
    expect(formatInAppTz(start, "HH:mm:ss")).toBe("00:00:00");

    const weekStart = startOfWeekInAppTz(now);
    // Sunday in Dhaka's calendar, not UTC's.
    expect(formatInAppTz(weekStart, "EEEE")).toBe("Sunday");
  });
});
