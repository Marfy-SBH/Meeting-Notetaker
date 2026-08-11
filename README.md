# Meeting Note Taker

AI meeting note taker built on a "record first, process later" architecture —
no real-time transcription, no live AI notes. Audio is recorded client-side,
saved on End Meeting, then transcribed and analyzed asynchronously.

## Stack

- Next.js 14 (App Router, TypeScript) + Tailwind CSS
- Supabase (Postgres + Auth + Storage)
- Browser MediaRecorder API for recording
- Google Gemini (`gemini-flash-latest`) for both transcription (native audio input — handles Bangla/English/Banglish) and summaries/minutes/decisions/action items — isolated in [lib/services/transcription-service.ts](lib/services/transcription-service.ts) and [lib/ai/summarize.ts](lib/ai/summarize.ts)
- Inngest for retryable background processing + scheduled reminders

## Setup

1. **Create a Supabase project** at supabase.com.
2. Run the SQL migrations in `supabase/migrations/` in order (via the SQL editor or `supabase db push`):
   - `0001_init.sql` — tables + profile/workspace auto-create trigger
   - `0002_rls.sql` — row level security + private `recordings` storage bucket
   - `0003_reminders.sql`
   - `0004_settings.sql`
   - `0005_recordings_update_policy.sql` — allows retrying a failed recording upload
3. Copy `.env.example` to `.env.local` and fill in:
   - Supabase URL/keys (Project Settings → API)
   - `GEMINI_API_KEY` (required — powers transcription and all summarization, from [aistudio.google.com](https://aistudio.google.com/apikey))
   - Google/Zoom/Slack OAuth credentials (optional — Integrations page falls back to a labeled "Connect (Demo)" mode when omitted, per the integration principle: never fake a capability, but keep the abstraction ready for real credentials)
4. Install and run:

```bash
npm install
npm run dev
```

5. In a second terminal, run the Inngest dev server so background processing and reminders actually execute:

```bash
npx inngest-cli dev
```

   Leave `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` empty for local dev — `INNGEST_DEV=1` (set in `.env.example`) routes events to this local dev server instead of Inngest Cloud. Only fill those keys in for a production deployment.

6. Sign up at `/signup`. From the Dashboard, click **Load Demo Data** to populate 6 realistic completed meetings (per the product spec) so the app doesn't look empty on first run.

## Architecture notes

- **Record first, process later**: `/live` only records audio (MediaRecorder). Ending a meeting uploads the file to Supabase Storage, then fires a background job (`lib/inngest/functions.ts`) that transcribes and analyzes it. Nothing AI-related runs during the meeting.
- **Provider isolation**: swap the LLM by editing only `lib/ai/summarize.ts`; swap transcription in `lib/services/transcription-service.ts`; swap storage/calendar/Zoom/Slack in their respective `lib/services/*-service.ts` files.
- **Retryable processing**: failures never delete the recording or meeting — the meeting detail page shows a "Retry Processing" action that re-fires the same background job.
