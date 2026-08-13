"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndWorkspace } from "@/lib/data/current";
import { MeetingService } from "@/lib/services/meeting-service";
import { StorageService } from "@/lib/services/storage-service";
import { triggerMeetingProcessing } from "@/lib/actions/processing";

export async function startMeeting(title: string) {
  const { user, workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();
  const meetingService = new MeetingService(supabase);

  const meeting = await meetingService.create({
    workspaceId: workspace.id,
    createdBy: user.id,
    title: title || "Untitled Meeting",
  });

  return { meetingId: meeting.id, workspaceId: workspace.id };
}

export async function startExistingMeeting(meetingId: string) {
  const { workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();
  const meetingService = new MeetingService(supabase);
  await meetingService.startExisting(meetingId);
  return { meetingId, workspaceId: workspace.id };
}

export async function getRecordingUploadTarget(meetingId: string) {
  const { workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();
  const storage = new StorageService(supabase);
  return { path: storage.recordingPath(workspace.id, meetingId) };
}

export async function finalizeMeeting(meetingId: string, durationSeconds: number) {
  // The storage path is never taken from client input — it's always derived
  // from the caller's own workspace, so there's nothing for a caller to point
  // at another workspace's recording. (Previously accepted the client-computed
  // path directly, which combined with the service-role processing pipeline
  // below to let a caller request a signed URL for ANY workspace's audio.)
  const { workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();
  const storage = new StorageService(supabase);
  const recordingPath = storage.recordingPath(workspace.id, meetingId);

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
  await supabase.from("meetings").update({ status: "cancelled" }).eq("id", meetingId);
}
