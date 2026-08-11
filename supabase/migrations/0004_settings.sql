alter table profiles add column if not exists settings jsonb not null default '{
  "recording": { "quality": "standard", "autoRecording": false },
  "ai": { "summaryLength": "standard", "noteStyle": "professional", "language": "auto", "speakerDetection": true },
  "notifications": { "meetingReminders": true, "summaryReady": true, "actionItemReminders": true }
}'::jsonb;
