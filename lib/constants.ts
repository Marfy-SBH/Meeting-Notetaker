// Recording cost/abuse guardrails (Priority 4a/4b). Keep these here rather
// than inline so they're easy to find and change in one place.

export const MAX_RECORDING_DURATION_MINUTES = 120;
export const MAX_RECORDING_DURATION_SECONDS = MAX_RECORDING_DURATION_MINUTES * 60;

// How long before the hard cutoff to warn the user their recording will
// auto-end, in seconds.
export const RECORDING_WARNING_LEAD_SECONDS = 10 * 60;

export const MAX_MEETINGS_PER_DAY = 5;

// Recordings older than this are auto-deleted from Storage; transcript/
// summary/decisions/action items are kept indefinitely (Priority 4c).
export const RECORDING_RETENTION_DAYS = 90;

// Chunked recording upload (reliability fix): audio uploads in ~30s pieces
// during the meeting instead of one file at the end, so a crash/network loss
// only costs the most recent chunk instead of the whole recording.
export const RECORDING_CHUNK_INTERVAL_MS = 30_000;
export const RECORDING_CHUNK_INTERVAL_SECONDS = RECORDING_CHUNK_INTERVAL_MS / 1000;
export const CHUNK_UPLOAD_RETRY_DELAYS_MS = [1_000, 3_000, 8_000];
