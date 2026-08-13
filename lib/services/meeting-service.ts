import type { SupabaseClient } from "@supabase/supabase-js";
import type { MeetingWithRelations } from "@/lib/types";
import { StorageService } from "@/lib/services/storage-service";

// Abstraction over meeting persistence so callers never touch raw table names directly.
export class MeetingService {
  private storage: StorageService;

  constructor(private supabase: SupabaseClient) {
    this.storage = new StorageService(supabase);
  }

  async listByWorkspace(workspaceId: string) {
    const { data, error } = await this.supabase
      .from("meetings")
      .select("*, participants(*)")
      .eq("workspace_id", workspaceId)
      .order("started_at", { ascending: false, nullsFirst: false })
      .order("scheduled_date", { ascending: false });
    if (error) throw error;
    return data;
  }

  async getWithRelations(meetingId: string): Promise<MeetingWithRelations | null> {
    const { data, error } = await this.supabase
      .from("meetings")
      .select(
        `*, participants(*),
         summary:summaries(*),
         minutes:meeting_minutes(*),
         action_items(*),
         decisions(*),
         important_moments(*),
         transcript_segments(*)`
      )
      .eq("id", meetingId)
      .single();
    if (error) return null;

    let recordingUrl: string | null = data.recording_url;
    if (recordingUrl) {
      try {
        recordingUrl = await this.storage.getSignedUrl(recordingUrl);
      } catch {
        recordingUrl = null;
      }
    }

    return {
      ...data,
      recording_url: recordingUrl,
      summary: Array.isArray(data.summary) ? data.summary[0] ?? null : data.summary,
      minutes: Array.isArray(data.minutes) ? data.minutes[0] ?? null : data.minutes,
    } as unknown as MeetingWithRelations;
  }

  async create(input: {
    workspaceId: string;
    createdBy: string;
    title: string;
    platform?: string;
    meetingLink?: string;
    timezone?: string;
  }) {
    const { data, error } = await this.supabase
      .from("meetings")
      .insert({
        workspace_id: input.workspaceId,
        created_by: input.createdBy,
        title: input.title,
        platform: input.platform ?? "in_app",
        meeting_link: input.meetingLink ?? null,
        timezone: input.timezone ?? "UTC",
        status: "recording",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Conditioned on status="scheduled" so this is an atomic compare-and-swap:
  // it can't restart an already-completed/recording meeting, and if two
  // people race to start the same scheduled meeting, only the first succeeds.
  async startExisting(meetingId: string) {
    const { data, error } = await this.supabase
      .from("meetings")
      .update({ status: "recording", started_at: new Date().toISOString() })
      .eq("id", meetingId)
      .eq("status", "scheduled")
      .select()
      .single();
    if (error) throw new Error("This meeting has already been started or is no longer scheduled.");
    return data;
  }

  async finalizeRecording(meetingId: string, recordingUrl: string, durationSeconds: number) {
    const { error } = await this.supabase
      .from("meetings")
      .update({
        status: "processing",
        ended_at: new Date().toISOString(),
        recording_url: recordingUrl,
        duration: durationSeconds,
        processing_step: "saved",
      })
      .eq("id", meetingId);
    if (error) throw error;
  }

  async updateProcessingStep(meetingId: string, step: string, error?: string) {
    await this.supabase
      .from("meetings")
      .update({ processing_step: step, processing_error: error ?? null })
      .eq("id", meetingId);
  }

  async markCompleted(meetingId: string) {
    await this.supabase
      .from("meetings")
      .update({ status: "completed", processing_step: "done" })
      .eq("id", meetingId);
  }

  async markFailed(meetingId: string, error: string) {
    await this.supabase
      .from("meetings")
      .update({ status: "failed", processing_step: "failed", processing_error: error })
      .eq("id", meetingId);
  }
}
