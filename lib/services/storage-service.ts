import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "recordings";

// Recordings are private; every read goes through a short-lived signed URL.
export class StorageService {
  constructor(private supabase: SupabaseClient) {}

  recordingPath(workspaceId: string, meetingId: string) {
    return `${workspaceId}/${meetingId}.webm`;
  }

  async upload(path: string, file: Blob) {
    const { error } = await this.supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "audio/webm",
      upsert: true,
    });
    if (error) throw error;
    return path;
  }

  async getSignedUrl(path: string, expiresInSeconds = 3600) {
    const { data, error } = await this.supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
    if (error) throw error;
    return data.signedUrl;
  }

  async deleteRecording(path: string) {
    const { error } = await this.supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;
  }
}
