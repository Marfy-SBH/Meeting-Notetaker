import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { handleProcessingFailure } from "@/lib/inngest/functions";

// Regression test for Priority 3a. Exercises the extracted onFailure logic
// directly against the real dev database (see tests/setup.ts) rather than
// spinning up the Inngest runtime — actually proving "Inngest only calls
// onFailure once after retries exhaust" would require driving Inngest's own
// retry/backoff scheduling end-to-end, which isn't something a fast
// deterministic unit test can assert; that guarantee is Inngest's documented
// platform behavior, not our code. What IS ours to verify: given exactly one
// invocation (the guarantee Inngest provides), this handler produces exactly
// one "processing_failed" notification and marks the meeting failed —
// previously, the same work happened inline in a try/catch that ran on
// EVERY failed attempt, so N retries meant N notifications for one failure.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

let workspaceId: string;
let createdBy: string;
const createdMeetingIds: string[] = [];

beforeAll(async () => {
  const { data: workspace, error } = await supabase.from("workspaces").select("id, owner_id").limit(1).single();
  if (error || !workspace) {
    throw new Error("No workspace found in the dev database — this test needs one to attach a throwaway meeting to.");
  }
  workspaceId = workspace.id;
  createdBy = workspace.owner_id;
});

afterEach(async () => {
  if (createdMeetingIds.length === 0) return;
  await supabase.from("notifications").delete().in("meeting_id", createdMeetingIds);
  await supabase.from("meetings").delete().in("id", createdMeetingIds);
  createdMeetingIds.length = 0;
});

describe("handleProcessingFailure (Inngest onFailure)", () => {
  it("marks the meeting failed and creates exactly one processing_failed notification", async () => {
    const { data: meeting, error: insertError } = await supabase
      .from("meetings")
      .insert({
        workspace_id: workspaceId,
        created_by: createdBy,
        title: "[test] onFailure fixture",
        status: "processing",
        timezone: "UTC",
      })
      .select()
      .single();
    expect(insertError).toBeNull();
    if (!meeting) throw new Error("Failed to create fixture meeting");
    createdMeetingIds.push(meeting.id);

    await handleProcessingFailure({
      event: { data: { event: { data: { meetingId: meeting.id } } } },
      error: new Error("simulated final failure after retries exhausted"),
    });

    const { data: finalRow } = await supabase.from("meetings").select("*").eq("id", meeting.id).single();
    expect(finalRow!.status).toBe("failed");
    expect(finalRow!.processing_error).toBe("simulated final failure after retries exhausted");

    const { data: notifications } = await supabase
      .from("notifications")
      .select("*")
      .eq("meeting_id", meeting.id)
      .eq("type", "processing_failed");
    expect(notifications).toHaveLength(1);
  });

  it("is a no-op if the meeting no longer exists (doesn't throw)", async () => {
    await expect(
      handleProcessingFailure({
        event: { data: { event: { data: { meetingId: "00000000-0000-0000-0000-000000000000" } } } },
        error: new Error("simulated failure"),
      })
    ).resolves.not.toThrow();
  });
});
