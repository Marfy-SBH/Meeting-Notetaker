import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { StorageService } from "@/lib/services/storage-service";

// Regression tests for the chunked recording upload reliability fix: audio
// now uploads in ~30s pieces during the meeting instead of one file at the
// end, and assembleChunks() is what reassembles them (or refuses to,
// clearly, if one never made it) before AI processing runs.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const BUCKET = "recordings";
let workspaceId: string;
const uploadedPaths: string[] = [];

beforeAll(async () => {
  const { data: workspace, error } = await supabase.from("workspaces").select("id").limit(1).single();
  if (error || !workspace) {
    throw new Error("No workspace found in the dev database — this test needs one to attach fixtures to.");
  }
  workspaceId = workspace.id;
});

afterEach(async () => {
  if (uploadedPaths.length > 0) {
    await supabase.storage.from(BUCKET).remove(uploadedPaths);
    uploadedPaths.length = 0;
  }
});

async function uploadChunk(storage: StorageService, meetingId: string, seq: number, text: string) {
  const path = storage.chunkPath(workspaceId, meetingId, seq);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, new Blob([text], { type: "audio/webm" }), { upsert: true });
  expect(error).toBeNull();
  uploadedPaths.push(path);
}

describe("StorageService.assembleChunks", () => {
  it(
    "concatenates every chunk in order into the canonical recording path",
    async () => {
      const storage = new StorageService(supabase);
      const meetingId = crypto.randomUUID();
      await uploadChunk(storage, meetingId, 0, "chunk-zero-");
      await uploadChunk(storage, meetingId, 1, "chunk-one-");
      await uploadChunk(storage, meetingId, 2, "chunk-two");

      const finalPath = await storage.assembleChunks(workspaceId, meetingId, 3, "audio/webm");
      expect(finalPath).toBe(storage.recordingPath(workspaceId, meetingId));
      uploadedPaths.push(finalPath);

      const { data, error } = await supabase.storage.from(BUCKET).download(finalPath);
      expect(error).toBeNull();
      const text = await data!.text();
      expect(text).toBe("chunk-zero-chunk-one-chunk-two");

      // Chunk objects should be cleaned up after a successful assemble.
      const { data: remaining } = await supabase.storage
        .from(BUCKET)
        .list(storage.chunkPrefix(workspaceId, meetingId));
      expect(remaining ?? []).toHaveLength(0);
    },
    // This test does ~8 sequential Storage round-trips (3 uploads, 3
    // downloads, 1 final upload, list+cleanup) — the default 5s timeout is
    // too tight for a real network round-trip per call.
    15_000
  );

  it("refuses to assemble and names the missing chunk when one never made it", async () => {
    const storage = new StorageService(supabase);
    const meetingId = crypto.randomUUID();
    await uploadChunk(storage, meetingId, 0, "chunk-zero");
    // seq 1 deliberately never uploaded.
    await uploadChunk(storage, meetingId, 2, "chunk-two");

    await expect(storage.assembleChunks(workspaceId, meetingId, 3, "audio/webm")).rejects.toThrow(/missing part\(s\) 1/);

    // The gap must not silently produce a partial final recording.
    const { data: finalObject } = await supabase.storage
      .from(BUCKET)
      .list(workspaceId, { search: `${meetingId}.webm` });
    expect(finalObject ?? []).toHaveLength(0);
  });

  it("rejects an expected chunk count of zero rather than assembling an empty recording", async () => {
    const storage = new StorageService(supabase);
    const meetingId = crypto.randomUUID();
    await expect(storage.assembleChunks(workspaceId, meetingId, 0, "audio/webm")).rejects.toThrow(
      /No audio was recorded/
    );
  });
});
