import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { RetentionService } from "@/lib/services/retention-service";

// Regression test for Priority 4c. Uploads a real (tiny) audio blob to the
// dev project's `recordings` bucket and inserts real transcript/summary/
// minutes/action-item/decision rows, then runs the sweep against a fixture
// meeting whose `ended_at` is mocked to be 100 days in the past — proving
// the job deletes the audio and clears recording_url while leaving every
// text-derived artifact untouched.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const BUCKET = "recordings";
let workspaceId: string;
let createdBy: string;
const createdMeetingIds: string[] = [];
const uploadedPaths: string[] = [];

beforeAll(async () => {
  const { data: workspace, error } = await supabase.from("workspaces").select("id, owner_id").limit(1).single();
  if (error || !workspace) {
    throw new Error("No workspace found in the dev database — this test needs one to attach a fixture to.");
  }
  workspaceId = workspace.id;
  createdBy = workspace.owner_id;
});

afterEach(async () => {
  if (uploadedPaths.length > 0) {
    await supabase.storage.from(BUCKET).remove(uploadedPaths);
    uploadedPaths.length = 0;
  }
  if (createdMeetingIds.length > 0) {
    await supabase.from("meetings").delete().in("id", createdMeetingIds);
    createdMeetingIds.length = 0;
  }
});

async function makeExpiredMeetingWithArtifacts(daysOld: number) {
  const path = `${workspaceId}/test-retention-${crypto.randomUUID()}.webm`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, new Blob(["fake audio bytes"], { type: "audio/webm" }), { upsert: true });
  expect(uploadError).toBeNull();
  uploadedPaths.push(path);

  const endedAt = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
  const { data: meeting, error: insertError } = await supabase
    .from("meetings")
    .insert({
      workspace_id: workspaceId,
      created_by: createdBy,
      title: `[test] retention fixture (${daysOld}d old)`,
      status: "completed",
      timezone: "UTC",
      ended_at: endedAt,
      recording_url: path,
      duration: 120,
    })
    .select()
    .single();
  expect(insertError).toBeNull();
  if (!meeting) throw new Error("Failed to create fixture meeting");
  createdMeetingIds.push(meeting.id);

  await supabase.from("transcript_segments").insert({
    meeting_id: meeting.id,
    speaker: "Speaker 1",
    start_time: 0,
    end_time: 5,
    text: "This transcript must survive retention cleanup.",
  });
  await supabase
    .from("summaries")
    .insert({ meeting_id: meeting.id, summary: "This summary must survive.", key_points: ["a", "b"] });
  await supabase.from("meeting_minutes").insert({ meeting_id: meeting.id, content: { agenda: ["item"] } });
  await supabase.from("action_items").insert({ meeting_id: meeting.id, task: "This action item must survive." });
  await supabase.from("decisions").insert({ meeting_id: meeting.id, text: "This decision must survive." });

  return { meeting, path };
}

describe("4c: recording retention sweep", () => {
  it("deletes audio and clears recording_url for a meeting past the retention window, keeping all text artifacts", async () => {
    const { meeting, path } = await makeExpiredMeetingWithArtifacts(100);

    const retention = new RetentionService(supabase);
    const threshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await retention.sweepExpiredRecordings(threshold);

    expect(result.deleted).toBeGreaterThanOrEqual(1);
    expect(result.failures).not.toContain(meeting.id);

    const { data: finalRow } = await supabase.from("meetings").select("*").eq("id", meeting.id).single();
    expect(finalRow!.recording_url).toBeNull();
    expect(finalRow!.audio_deleted_at).not.toBeNull();

    // The Storage object should actually be gone, not just unreferenced.
    const { data: stillThere } = await supabase.storage.from(BUCKET).list(workspaceId, { search: path.split("/")[1] });
    expect(stillThere ?? []).toHaveLength(0);
    uploadedPaths.length = 0; // already deleted by the sweep — nothing left for afterEach to clean up

    // All text-derived artifacts must still exist, untouched.
    const [transcript, summary, minutes, actionItems, decisions] = await Promise.all([
      supabase.from("transcript_segments").select("*").eq("meeting_id", meeting.id),
      supabase.from("summaries").select("*").eq("meeting_id", meeting.id).single(),
      supabase.from("meeting_minutes").select("*").eq("meeting_id", meeting.id).single(),
      supabase.from("action_items").select("*").eq("meeting_id", meeting.id),
      supabase.from("decisions").select("*").eq("meeting_id", meeting.id),
    ]);
    expect(transcript.data).toHaveLength(1);
    expect(summary.data?.summary).toBe("This summary must survive.");
    expect(minutes.data?.content).toEqual({ agenda: ["item"] });
    expect(actionItems.data).toHaveLength(1);
    expect(decisions.data).toHaveLength(1);
  });

  it("does not touch a meeting that hasn't reached the retention window yet", async () => {
    const { meeting } = await makeExpiredMeetingWithArtifacts(5); // well within 90 days

    const retention = new RetentionService(supabase);
    const threshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    await retention.sweepExpiredRecordings(threshold);

    const { data: finalRow } = await supabase.from("meetings").select("*").eq("id", meeting.id).single();
    expect(finalRow!.recording_url).not.toBeNull();
    expect(finalRow!.audio_deleted_at).toBeNull();
  });
});
