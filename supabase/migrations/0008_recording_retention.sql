-- 4c: tracks when a recording's audio was auto-deleted per the retention
-- policy, distinct from a meeting that simply never had a recording_url in
-- the first place (still processing, failed before upload, etc) — the UI
-- needs to tell those two cases apart.
alter table meetings add column if not exists audio_deleted_at timestamptz;
