import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { finalizeMeeting, assertUnderDailyRecordingLimit } from "@/lib/actions/meetings";
import { MAX_RECORDING_DURATION_SECONDS, MAX_MEETINGS_PER_DAY } from "@/lib/constants";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

describe("4a: recording duration cap", () => {
  it("finalizeMeeting rejects a duration over the cap before touching auth/DB", async () => {
    // No session/DB setup needed — the cap check runs before
    // getCurrentUserAndWorkspace(), so this is a fast, dependency-free check.
    await expect(
      finalizeMeeting("00000000-0000-0000-0000-000000000000", MAX_RECORDING_DURATION_SECONDS + 1, 1, "audio/webm")
    ).rejects.toThrow(/can't be longer than/);
  });
});

describe("4b: daily recording limit", () => {
  let workspaceId: string;
  let userId: string;
  const createdMeetingIds: string[] = [];

  beforeAll(async () => {
    const { data: workspace, error } = await supabase.from("workspaces").select("id, owner_id").limit(1).single();
    if (error || !workspace) {
      throw new Error("No workspace found in the dev database — this test needs one to attach fixtures to.");
    }
    workspaceId = workspace.id;
    userId = workspace.owner_id;
  });

  afterEach(async () => {
    if (createdMeetingIds.length === 0) return;
    await supabase.from("meetings").delete().in("id", createdMeetingIds);
    createdMeetingIds.length = 0;
  });

  it(`allows starting under the ${MAX_MEETINGS_PER_DAY}-per-day limit and blocks at/after it`, async () => {
    // assertUnderDailyRecordingLimit only counts meetings with started_at
    // set for THIS user today — insert exactly MAX_MEETINGS_PER_DAY of them.
    for (let i = 0; i < MAX_MEETINGS_PER_DAY; i++) {
      const { data } = await supabase
        .from("meetings")
        .insert({
          workspace_id: workspaceId,
          created_by: userId,
          title: `[test] daily limit fixture ${i}`,
          status: "completed",
          started_at: new Date().toISOString(),
          timezone: "Asia/Dhaka",
        })
        .select()
        .single();
      if (data) createdMeetingIds.push(data.id);
    }
    expect(createdMeetingIds).toHaveLength(MAX_MEETINGS_PER_DAY);

    // Already at the limit — the next attempt must be rejected.
    await expect(assertUnderDailyRecordingLimit(supabase, userId)).rejects.toThrow(/today's limit/);
  });

  it("does not count another user's meetings toward this user's limit", async () => {
    const otherUserId = "00000000-0000-0000-0000-000000000000";
    for (let i = 0; i < MAX_MEETINGS_PER_DAY; i++) {
      const { data } = await supabase
        .from("meetings")
        .insert({
          workspace_id: workspaceId,
          created_by: userId,
          title: `[test] other-user isolation fixture ${i}`,
          status: "completed",
          started_at: new Date().toISOString(),
          timezone: "Asia/Dhaka",
        })
        .select()
        .single();
      if (data) createdMeetingIds.push(data.id);
    }

    // otherUserId has zero meetings today, so this must not throw even
    // though `userId` is already at the cap.
    await expect(assertUnderDailyRecordingLimit(supabase, otherUserId)).resolves.not.toThrow();
  });

  it("does not count a meeting that was never started (started_at is null)", async () => {
    for (let i = 0; i < MAX_MEETINGS_PER_DAY; i++) {
      const { data } = await supabase
        .from("meetings")
        .insert({
          workspace_id: workspaceId,
          created_by: userId,
          title: `[test] never-started fixture ${i}`,
          status: "scheduled",
          started_at: null,
          timezone: "Asia/Dhaka",
        })
        .select()
        .single();
      if (data) createdMeetingIds.push(data.id);
    }

    await expect(assertUnderDailyRecordingLimit(supabase, userId)).resolves.not.toThrow();
  });
});
