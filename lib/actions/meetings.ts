"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndWorkspace } from "@/lib/data/current";
import { MeetingService } from "@/lib/services/meeting-service";
import { StorageService } from "@/lib/services/storage-service";
import { triggerMeetingProcessing } from "@/lib/actions/processing";
import { MAX_RECORDING_DURATION_SECONDS, MAX_MEETINGS_PER_DAY } from "@/lib/constants";
import { startOfDayInAppTz, endOfDayInAppTz } from "@/lib/meeting-grouping";

export async function assertUnderDailyRecordingLimit(supabase: SupabaseClient, userId: string) {
  const now = new Date();
  const { count, error } = await supabase
    .from("meetings")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId)
    .not("started_at", "is", null)
    .gte("started_at", startOfDayInAppTz(now).toISOString())
    .lte("started_at", endOfDayInAppTz(now).toISOString());

  if (error) throw error;
  if ((count ?? 0) >= MAX_MEETINGS_PER_DAY) {
    throw new Error(
      `You've reached today's limit of ${MAX_MEETINGS_PER_DAY} recorded meetings. This resets at midnight.`
    );
  }
}

export async function startMeeting(title: string) {
  const { user, workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();
  await assertUnderDailyRecordingLimit(supabase, user.id);
  const meetingService = new MeetingService(supabase);

  const meeting = await meetingService.create({
    workspaceId: workspace.id,
    createdBy: user.id,
    title: title || "Untitled Meeting",
  });

  return { meetingId: meeting.id, workspaceId: workspace.id };
}

export async function startExistingMeeting(meetingId: string) {
  const { user, workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();
  await assertUnderDailyRecordingLimit(supabase, user.id);
  const meetingService = new MeetingService(supabase);
  await meetingService.startExisting(meetingId);
  return { meetingId, workspaceId: workspace.id };
}

export async function getChunkUploadTarget(meetingId: string, seq: number) {
  const { workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();
  const storage = new StorageService(supabase);
  return { path: storage.chunkPath(workspace.id, meetingId, seq) };
}

export async function finalizeMeeting(
  meetingId: string,
  durationSeconds: number,
  chunkCount: number,
  contentType: string
) {
  // Defense-in-depth: the client already auto-ends at MAX_RECORDING_DURATION_SECONDS
  // (live-meeting.tsx), but that's bypassable by calling this action directly
  // with a fabricated duration — reject rather than silently accept it.
  if (durationSeconds > MAX_RECORDING_DURATION_SECONDS) {
    throw new Error(`Recordings can't be longer than ${MAX_RECORDING_DURATION_SECONDS / 60} minutes.`);
  }

  // The storage path is never taken from client input — it's always derived
  // from the caller's own workspace, so there's nothing for a caller to point
  // at another workspace's recording. (Previously accepted the client-computed
  // path directly, which combined with the service-role processing pipeline
  // below to let a caller request a signed URL for ANY workspace's audio.)
  const { workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();
  const storage = new StorageService(supabase);

  // Assembles the per-chunk uploads into the single file the rest of the
  // pipeline already expects at this path — throws with a specific message
  // naming the missing portion if any chunk never made it, instead of
  // silently finalizing a partial recording.
  const recordingPath = await storage.assembleChunks(workspace.id, meetingId, chunkCount, contentType);

  const meetingService = new MeetingService(supabase);
  await meetingService.finalizeRecording(meetingId, recordingPath, durationSeconds);

  // The recording itself is already saved at this point — a failure to kick off
  // AI processing is a separate, retryable problem (see ProcessingBanner), not
  // an upload failure. Don't let it bubble up and make the client think the
  // recording was lost.
  try {
    await triggerMeetingProcessing(meetingId);
  } catch (err) {
    console.error(`Failed to trigger processing for meeting ${meetingId}:`, err);
    await meetingService.markFailed(meetingId, err instanceof Error ? err.message : "Failed to start AI processing.");
  }
}

export async function cancelMeeting(meetingId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .update({ status: "cancelled" })
    .eq("id", meetingId)
    .select()
    .single();
  if (error || !data) throw new Error("Could not cancel this meeting.");
}
