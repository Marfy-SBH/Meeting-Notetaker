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

export async function getRecordingUploadTarget(meetingId: string) {
  const { workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();
  const storage = new StorageService(supabase);
  return { path: storage.recordingPath(workspace.id, meetingId) };
}

export async function finalizeMeeting(meetingId: string, recordingPath: string, durationSeconds: number) {
  const supabase = await createClient();
  const meetingService = new MeetingService(supabase);
  await meetingService.finalizeRecording(meetingId, recordingPath, durationSeconds);
  await triggerMeetingProcessing(meetingId);
}

export async function cancelMeeting(meetingId: string) {
  const supabase = await createClient();
  await supabase.from("meetings").update({ status: "cancelled" }).eq("id", meetingId);
}
