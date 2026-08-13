import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { MeetingService } from "@/lib/services/meeting-service";

// Regression test for Priority 1a/1c: finalizeRecording() must throw when its
// update affects zero rows (e.g. the meetingId doesn't belong to the caller's
// workspace and RLS silently filtered the update) instead of reporting
// success — that silent no-op is exactly what let finalizeMeeting() fall
// through to triggering AI processing on a meeting the caller didn't own.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

describe("finalizeRecording zero-row guard", () => {
  it("throws instead of silently succeeding when no matching meeting is updated", async () => {
    const meetingService = new MeetingService(supabase);
    const nonExistentMeetingId = "00000000-0000-0000-0000-000000000000";

    await expect(meetingService.finalizeRecording(nonExistentMeetingId, "some/path.webm", 60)).rejects.toThrow();
  });
});
