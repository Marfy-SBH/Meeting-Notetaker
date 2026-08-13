# Chunked Recording Upload — Scoping & Plan

Context: meeting audio currently records entirely in browser memory (`MediaRecorder`)
and uploads as one file only after the meeting ends. If the browser crashes, the tab
closes, or the server restarts before that final upload completes, the whole
recording is lost. This happened twice in one session (2026-08-11). Fix: upload audio
in small chunks *during* the meeting, so a failure only loses the last ~30s instead of
the whole recording.

## Scoping answers

### 1. Where MediaRecorder is instantiated / how the final blob uploads today

- `components/live/live-meeting.tsx:97-103` — `new MediaRecorder(stream)` with no
  `timeslice`, so `ondataavailable` only fires once, at `recorder.stop()`. All audio
  sits in `chunksRef.current` (a plain array in a React ref) for the whole meeting.
- `live-meeting.tsx:150-158` — on "End Meeting," all chunks are concatenated into one
  `Blob` and uploaded in a single `supabase.storage.upload()` call, to a single
  deterministic path from `StorageService.recordingPath()`
  (`lib/services/storage-service.ts:9-11`): `${workspaceId}/${meetingId}.webm`.
- That path is read back in exactly one place: `lib/inngest/functions.ts:107-113`,
  which gets one signed URL and hands the whole file to Gemini as one blob
  (`lib/services/transcription-service.ts:29-36`).

### 2. Chunk interval via `timeslice`

Safe to add — there is no live transcript or waveform feature anywhere in this
codebase (`transcript-tab.tsx` is a post-processing *display* tab only; no
`AudioContext`/`AnalyserNode` usage). Adding `recorder.start(30_000)` is a pure
addition: `ondataavailable` now fires every ~30s instead of once at the end, and
nothing else reads from `recorder`/`chunksRef` that would be disrupted.

Constraint: chunks from a single continuous `MediaRecorder` session are only valid
**concatenated in order** — not independently decodable WebM files. Fine, since
that's exactly how the current code already reassembles them (`new
Blob(chunksRef.current)`); it just means order must be preserved by sequence number.

### 3. Storage strategy

Supabase Storage has no append/multipart-merge for a single object via the plain
upload API (TUS-based resumable upload exists but is for resuming upload of one
already-fully-formed file, not one still being produced live — and would be a new
protocol/dependency this codebase doesn't use anywhere).

**Chosen: N separate chunk objects, reusing the existing upload API as-is.** Each
chunk uploads immediately to `${workspaceId}/${meetingId}/chunks/{seq}.webm`
(zero-padded). A server-side step then downloads all chunks in order, concatenates
them (byte concatenation — same operation the client already does with `new
Blob([...])`, just server-side with fetched buffers), and uploads the result to the
exact same canonical path `StorageService.recordingPath()` already produces. Zero
changes needed to `TranscriptionService`, RLS path derivation, or `RetentionService`
— they keep reading `meeting.recording_url` exactly as today.

### 4. Chunk upload failure mid-meeting

Per-chunk retry with backoff (1s / 3s / 8s delays between attempts), tracked
client-side. A failing chunk doesn't block recording — new chunks keep queuing and
uploading independently while a failed one retries in the background. Only when
retries are fully exhausted does it count toward a subtle "N chunk(s) retrying/stuck"
indicator — never a blocking error during the meeting.

### 5. How "finalize" changes

`finalizeMeeting` (`lib/actions/meetings.ts`) still marks the meeting
recording-finalized and triggers processing — but a new step runs *before* that: list
all chunk objects for the meeting, verify the sequence is complete (client reports its
own expected chunk count), and:
- if complete: download + concatenate + write to the canonical path + delete the
  chunk objects,
- if incomplete: fail clearly, naming which chunk(s)/time range are missing, rather
  than silently transcribing a gap.

## Plan

1. **Client** (`live-meeting.tsx`): `recorder.start(30_000)`; each `ondataavailable`
   immediately uploads that chunk (new server action for the per-chunk path) with
   retry-with-backoff; track per-chunk status so a permanently-stuck chunk surfaces a
   subtle indicator without blocking recording. Before finalizing, wait for all
   in-flight/retrying uploads to settle and make one more attempt at anything still
   failed.
2. **New server action** `getChunkUploadTarget(meetingId, seq)` returning the
   per-chunk storage path.
3. **`StorageService`**: `chunkPath`/`chunkPrefix` helpers + `assembleChunks()` —
   lists, verifies completeness, downloads, concatenates, uploads to the canonical
   path, deletes the chunk objects. Throws a clear, specific error on a gap.
4. **Wire into finalize**: `finalizeMeeting` calls `assembleChunks()` first; only
   proceeds to the existing finalize/trigger-processing logic if assembly succeeds.
5. **Storage/RLS**: no schema or policy change needed — chunks live under a
   `.../chunks/` prefix in the same `recordings` bucket; the existing policies key off
   `storage.foldername(name)[1]` (the workspace id), which is unchanged.
6. **Tab-close warning**: copy updated to reflect that most of the recording is
   already safe — only the most recent ~30s is actually at risk.
7. **Tests** (vitest, following the existing real-Supabase integration style used in
   `tests/security.finalizeRecording.test.ts` / `tests/retention.test.ts`): a pure
   unit test for the retry-with-backoff utility, plus integration tests for
   `assembleChunks()` covering missing-chunk detection and the full-success path.

## Manual test checklist (after implementation)

1. Start recording a meeting.
2. Wait long enough for 2-3 chunks to upload (~90s at the 30s interval).
3. Kill the local dev server mid-meeting.
4. Confirm the already-uploaded chunks are visible in Supabase Storage under
   `{workspace}/{meeting}/chunks/`.
5. Restart the dev server.
6. End the meeting.
7. Confirm only the actual gap (audio recorded while the server was down, since
   chunk *uploads* — not recording itself — were paused) is reported missing, not the
   whole recording; the assemble step should name it specifically.
