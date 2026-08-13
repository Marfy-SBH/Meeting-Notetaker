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
