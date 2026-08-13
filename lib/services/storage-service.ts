import type { SupabaseClient } from "@supabase/supabase-js";
import { RECORDING_CHUNK_INTERVAL_SECONDS } from "@/lib/constants";

const BUCKET = "recordings";
const CHUNK_NAME_DIGITS = 5;

// Recordings are private; every read goes through a short-lived signed URL.
export class StorageService {
  constructor(private supabase: SupabaseClient) {}

  recordingPath(workspaceId: string, meetingId: string) {
    return `${workspaceId}/${meetingId}.webm`;
  }

  chunkPrefix(workspaceId: string, meetingId: string) {
    return `${workspaceId}/${meetingId}/chunks`;
  }

  chunkPath(workspaceId: string, meetingId: string, seq: number) {
    return `${this.chunkPrefix(workspaceId, meetingId)}/${String(seq).padStart(CHUNK_NAME_DIGITS, "0")}.webm`;
  }

  async upload(path: string, file: Blob) {
    const { error } = await this.supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "audio/webm",
      upsert: true,
    });
    // Re-throwing the raw StorageError class instance here (rather than a
    // plain Error) breaks once this runs inside a Server Action reachable
    // directly from the client — Next.js's Flight serializer rejects thrown
    // class instances crossing that boundary with an opaque "Only plain
    // objects... Classes... not supported" error, hiding the real cause.
    if (error) throw new Error(`Failed to upload to storage path "${path}": ${error.message}`);
    return path;
  }

  // Verifies every expected chunk (0..expectedChunkCount-1) actually made it
  // to Storage, then concatenates them in order into the same canonical path
  // recordingPath() already produces — so nothing downstream (transcription,
  // RLS path derivation, retention) needs to know chunking happened at all.
  // Throws with a specific, user-facing message on a gap rather than
  // silently assembling a partial recording.
  async assembleChunks(
    workspaceId: string,
    meetingId: string,
    expectedChunkCount: number,
    contentType: string
  ): Promise<string> {
    const prefix = this.chunkPrefix(workspaceId, meetingId);
    const finalPath = this.recordingPath(workspaceId, meetingId);

    if (expectedChunkCount <= 0) {
      throw new Error("No audio was recorded for this meeting.");
    }

    const { data: objects, error: listError } = await this.supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: expectedChunkCount + 10 });
    if (listError) throw new Error(`Failed to list recording chunks: ${listError.message}`);

    const foundSeqs = new Set((objects ?? []).map((o) => parseInt(o.name.replace(/\.webm$/, ""), 10)));
    const missing: number[] = [];
    for (let seq = 0; seq < expectedChunkCount; seq++) {
      if (!foundSeqs.has(seq)) missing.push(seq);
    }
    if (missing.length > 0) {
      const ranges = missing
        .map((seq) => `~${seq * RECORDING_CHUNK_INTERVAL_SECONDS}-${(seq + 1) * RECORDING_CHUNK_INTERVAL_SECONDS}s`)
        .join(", ");
      throw new Error(
        `Recording is incomplete — missing part(s) ${missing.join(", ")} (around ${ranges} into the meeting). ` +
          `The rest of the recording is safe.`
      );
    }

    const buffers: ArrayBuffer[] = [];
    for (let seq = 0; seq < expectedChunkCount; seq++) {
      const { data, error } = await this.supabase.storage.from(BUCKET).download(this.chunkPath(workspaceId, meetingId, seq));
      if (error || !data) throw new Error(`Failed to read chunk ${seq} while assembling the recording.`);
      buffers.push(await data.arrayBuffer());
    }

    const finalBlob = new Blob(buffers, { type: contentType || "audio/webm" });
    await this.upload(finalPath, finalBlob);

    // Best-effort cleanup — leftover chunk objects don't affect correctness,
    // so a failure here shouldn't fail the whole finalize.
    const chunkPaths = Array.from({ length: expectedChunkCount }, (_, seq) => this.chunkPath(workspaceId, meetingId, seq));
    await this.supabase.storage
      .from(BUCKET)
      .remove(chunkPaths)
      .catch(() => {});

    return finalPath;
  }

  async getSignedUrl(path: string, expiresInSeconds = 3600) {
    const { data, error } = await this.supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
    if (error) throw new Error(`Failed to create signed URL for "${path}": ${error.message}`);
    return data.signedUrl;
  }

  async deleteRecording(path: string) {
    const { error } = await this.supabase.storage.from(BUCKET).remove([path]);
    if (error) throw new Error(`Failed to delete recording "${path}": ${error.message}`);
  }
}
