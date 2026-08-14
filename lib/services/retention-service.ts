import type { SupabaseClient } from "@supabase/supabase-js";
import { StorageService } from "@/lib/services/storage-service";
import { toPlainError } from "@/lib/errors";

// Deletes recording audio past the retention window while leaving every
// text-derived artifact (transcript_segments, summaries, meeting_minutes,
// action_items, decisions) untouched — those tables are never referenced
// here at all, so there's nothing for this service to accidentally touch.
export class RetentionService {
  private storage: StorageService;

  constructor(private supabase: SupabaseClient) {
    this.storage = new StorageService(supabase);
  }

  // `ended_at` is this project's equivalent of "finalized_at" — it's set the
  // moment a recording finishes uploading and processing begins (see
  // MeetingService.finalizeRecording), which is the natural point to start
  // the retention clock from.
  async findExpiredRecordings(olderThan: Date) {
    const { data, error } = await this.supabase
      .from("meetings")
      .select("id, recording_url, ended_at")
      .not("recording_url", "is", null)
      .lt("ended_at", olderThan.toISOString());
    if (error) throw toPlainError(error, "Failed to find expired recordings.");
    return data ?? [];
  }

  async deleteRecordingAudio(meetingId: string, recordingPath: string) {
    await this.storage.deleteRecording(recordingPath);
    const { error } = await this.supabase
      .from("meetings")
      .update({ recording_url: null, audio_deleted_at: new Date().toISOString() })
      .eq("id", meetingId);
    if (error) throw toPlainError(error, "Failed to clear recording_url after deleting audio.");
  }

  async sweepExpiredRecordings(olderThan: Date) {
    const expired = await this.findExpiredRecordings(olderThan);
    let deleted = 0;
    const failures: string[] = [];

    for (const meeting of expired) {
      try {
        await this.deleteRecordingAudio(meeting.id, meeting.recording_url!);
        deleted++;
      } catch (err) {
        console.error(`Failed to delete recording for meeting ${meeting.id}:`, err);
        failures.push(meeting.id);
      }
    }

    return { checked: expired.length, deleted, failures };
  }
}
