import { inngest } from "@/lib/inngest/client";
import { createServiceClient } from "@/lib/supabase/server";
import { MeetingService } from "@/lib/services/meeting-service";
import { TranscriptionService } from "@/lib/services/transcription-service";
import { AIAnalysisService } from "@/lib/services/ai-analysis-service";
import { NotificationService } from "@/lib/services/notification-service";
import { StorageService } from "@/lib/services/storage-service";
import { meetingDateTime } from "@/lib/meeting-grouping";

export const sendMeetingReminders = inngest.createFunction(
  { id: "send-meeting-reminders" },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    const supabase = createServiceClient();
    const notifications = new NotificationService(supabase);

    await step.run("check-due-reminders", async () => {
      const { data: meetings } = await supabase
        .from("meetings")
        .select("*")
        .eq("status", "scheduled")
        .eq("reminder_sent", false)
        .not("scheduled_date", "is", null);

      const now = Date.now();
      for (const meeting of meetings ?? []) {
        // meetingDateTime() correctly interprets scheduled_date/scheduled_start_time
        // against the meeting's own stored timezone — a naive `new Date(string)`
        // parse here (the previous code) is interpreted in the *server process's*
        // ambient timezone, which silently fires reminders hours off whenever the
        // deployment isn't coincidentally set to the same zone the meeting was
        // scheduled in.
        const startTime = meetingDateTime(meeting).getTime();
        const reminderAt = startTime - (meeting.reminder_minutes ?? 15) * 60_000;
        if (now >= reminderAt && now < startTime) {
          const minutesLeft = Math.max(1, Math.round((startTime - now) / 60_000));
          await notifications.create({
            userId: meeting.created_by,
            meetingId: meeting.id,
            type: "meeting_reminder",
            title: `${meeting.title} starts in ${minutesLeft} minutes`,
            message: `Get ready — your meeting starts soon.`,
          });
          await supabase.from("meetings").update({ reminder_sent: true }).eq("id", meeting.id);
        }
      }
    });
  }
);

// Extracted so it's unit-testable in isolation (see
// tests/inngest.onFailure.test.ts) without spinning up the Inngest runtime.
// Inngest guarantees this fires exactly once, only after all retries for the
// triggering function are exhausted — this replaces the previous inline
// try/catch, which ran (and re-notified) on every failed attempt.
export async function handleProcessingFailure({
  event,
  error,
}: {
  event: { data: { event: { data: { meetingId: string } } } };
  error: Error;
}) {
  const { meetingId } = event.data.event.data;
  const supabase = createServiceClient();
  const meetings = new MeetingService(supabase);
  const notifications = new NotificationService(supabase);

  const { data: meeting } = await supabase.from("meetings").select("*").eq("id", meetingId).single();
  if (!meeting) return;

  await meetings.markFailed(meetingId, error.message);
  await notifications.create({
    userId: meeting.created_by,
    meetingId,
    type: "processing_failed",
    title: "AI processing failed",
    message: `We couldn't finish processing "${meeting.title}". Your recording is safe — you can retry.`,
  });
}

export const processMeeting = inngest.createFunction(
  {
    id: "process-meeting",
    retries: 3,
    onFailure: handleProcessingFailure,
  },
  { event: "meeting/ended" },
  async ({ event, step }) => {
    const { meetingId } = event.data;
    const supabase = createServiceClient();
    const meetings = new MeetingService(supabase);
    const notifications = new NotificationService(supabase);

    const meeting = await step.run("load-meeting", async () => {
      const { data, error } = await supabase.from("meetings").select("*").eq("id", meetingId).single();
      if (error || !data) throw new Error(`Meeting ${meetingId} not found`);
      return data;
    });

    // No inline try/catch — a thrown step error naturally fails this attempt
    // and triggers Inngest's retry; onFailure (above) marks the meeting
    // failed and notifies exactly once, only once retries are exhausted.
    const transcriptLines = await step.run("transcribe", async () => {
      await meetings.updateProcessingStep(meetingId, "transcribing");
      if (!meeting.recording_url) throw new Error("Recording is missing — cannot transcribe.");

      const storage = new StorageService(supabase);
      const signedUrl = await storage.getSignedUrl(meeting.recording_url, 3600);

      const transcription = new TranscriptionService();
      const lines = await transcription.transcribe(signedUrl);

      await supabase.from("transcript_segments").delete().eq("meeting_id", meetingId);
      if (lines.length > 0) {
        await supabase.from("transcript_segments").insert(
          lines.map((l) => ({
            meeting_id: meetingId,
            speaker: l.speaker,
            start_time: l.start,
            end_time: l.end,
            text: l.text,
          }))
        );
      }
      return lines;
    });

    const analysis = await step.run("analyze", async () => {
      await meetings.updateProcessingStep(meetingId, "summarizing");
      const { data: hostProfile } = await supabase
        .from("profiles")
        .select("settings")
        .eq("id", meeting.created_by)
        .single();
      const aiConfig = (hostProfile?.settings as any)?.aiConfig;
      const providerConfig =
        aiConfig?.provider && aiConfig?.apiKey ? { provider: aiConfig.provider, apiKey: aiConfig.apiKey } : undefined;

      const analysisService = new AIAnalysisService(supabase);
      const result = await analysisService.analyze(transcriptLines, { meetingTitle: meeting.title, providerConfig });

      await meetings.updateProcessingStep(meetingId, "action_items");
      await analysisService.persist(meetingId, result);
      return result;
    });

    await step.run("finalize", async () => {
      await meetings.markCompleted(meetingId);

      await notifications.create({
        userId: meeting.created_by,
        meetingId,
        type: "summary_ready",
        title: "Meeting summary is ready",
        message: `Notes for "${meeting.title}" are ready to review.`,
      });

      if (analysis.actionItems.length > 0) {
        await notifications.create({
          userId: meeting.created_by,
          meetingId,
          type: "action_items_detected",
          title: `${analysis.actionItems.length} new action items were detected`,
          message: `From "${meeting.title}"`,
        });
      }
    });
  }
);
