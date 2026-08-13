import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Integration test against the real dev Supabase project (see tests/setup.ts,
// which loads .env.local). Uses the service-role key to set up/tear down a
// throwaway meeting row directly — this intentionally bypasses RLS the same
// way a controlled test fixture should, and every row it creates is deleted
// in `afterEach` regardless of pass/fail.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

let workspaceId: string;
let createdBy: string;
const createdMeetingIds: string[] = [];

beforeAll(async () => {
  const { data: workspace, error } = await supabase.from("workspaces").select("id, owner_id").limit(1).single();
  if (error || !workspace) {
    throw new Error(
      "No workspace found in the dev database — this test needs at least one existing workspace to attach a throwaway meeting to."
    );
  }
  workspaceId = workspace.id;
  createdBy = workspace.owner_id;
});

afterEach(async () => {
  if (createdMeetingIds.length === 0) return;
  await supabase.from("meetings").delete().in("id", createdMeetingIds);
  createdMeetingIds.length = 0;
});

// Mirrors MeetingService.startExisting's exact query (lib/services/meeting-service.ts)
// so this test actually exercises the same compare-and-swap the app relies on.
async function startExisting(meetingId: string) {
  return supabase
    .from("meetings")
    .update({ status: "recording", started_at: new Date().toISOString() })
    .eq("id", meetingId)
    .eq("status", "scheduled")
    .select()
    .single();
}

describe("startExisting compare-and-swap", () => {
  it("lets exactly one of two concurrent start attempts on the same scheduled meeting succeed", async () => {
    const { data: meeting, error: insertError } = await supabase
      .from("meetings")
      .insert({
        workspace_id: workspaceId,
        created_by: createdBy,
        title: "[test] concurrency race fixture",
        status: "scheduled",
        scheduled_date: "2026-01-01",
        scheduled_start_time: "10:00:00",
        timezone: "UTC",
      })
      .select()
      .single();
    expect(insertError).toBeNull();
    if (!meeting) throw new Error("Failed to create fixture meeting");
    createdMeetingIds.push(meeting.id);

    // Fire both "start" attempts genuinely concurrently — no await between them.
    const [first, second] = await Promise.all([startExisting(meeting.id), startExisting(meeting.id)]);

    const results = [first, second];
    const succeeded = results.filter((r) => !r.error && r.data);
    const failed = results.filter((r) => r.error || !r.data);

    // Exactly one must win the race — this is the whole point of the guard.
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(succeeded[0].data!.status).toBe("recording");
    expect(succeeded[0].data!.started_at).not.toBeNull();

    // The row's final state must reflect a single winner, not a merge of both.
    const { data: finalRow } = await supabase.from("meetings").select("*").eq("id", meeting.id).single();
    expect(finalRow!.status).toBe("recording");
  });

  it("refuses to start a meeting that isn't in 'scheduled' status", async () => {
    const { data: meeting, error: insertError } = await supabase
      .from("meetings")
      .insert({
        workspace_id: workspaceId,
        created_by: createdBy,
        title: "[test] already-completed fixture",
        status: "completed",
        timezone: "UTC",
      })
      .select()
      .single();
    expect(insertError).toBeNull();
    if (!meeting) throw new Error("Failed to create fixture meeting");
    createdMeetingIds.push(meeting.id);

    const result = await startExisting(meeting.id);
    expect(result.error).not.toBeNull();

    const { data: finalRow } = await supabase.from("meetings").select("*").eq("id", meeting.id).single();
    expect(finalRow!.status).toBe("completed");
  });
});
