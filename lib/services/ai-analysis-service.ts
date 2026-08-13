import type { SupabaseClient } from "@supabase/supabase-js";
import { analyzeMeeting, type TranscriptLine, type MeetingAnalysis, type ProviderConfig } from "@/lib/ai/summarize";

export class AIAnalysisService {
  constructor(private supabase: SupabaseClient) {}

  async analyze(
    lines: TranscriptLine[],
    opts?: { meetingTitle?: string; summaryLength?: "brief" | "standard" | "detailed"; providerConfig?: ProviderConfig }
  ): Promise<MeetingAnalysis> {
    return analyzeMeeting(lines, opts);
  }

  async persist(meetingId: string, analysis: MeetingAnalysis) {
    await this.supabase.from("summaries").upsert(
      {
        meeting_id: meetingId,
        // "summary" is a text column storing both languages as a JSON string
        // ({bn, en}) — parsed back out in the Summary tab.
        summary: JSON.stringify(analysis.summary),
        key_points: analysis.keyPoints,
        decisions: analysis.decisions.map((d) => d.text),
      },
      { onConflict: "meeting_id" }
    );

    await this.supabase.from("meeting_minutes").upsert(
      { meeting_id: meetingId, content: analysis.minutes },
      { onConflict: "meeting_id" }
    );

    if (analysis.actionItems.length > 0) {
      await this.supabase.from("action_items").insert(
        analysis.actionItems.map((a) => ({
          meeting_id: meetingId,
          task: a.task,
          assignee: a.assignee,
          due_date: a.dueDate,
          status: "pending",
        }))
      );
    }

    if (analysis.decisions.length > 0) {
      await this.supabase.from("decisions").insert(
        analysis.decisions.map((d) => ({
          meeting_id: meetingId,
          text: d.text,
          timestamp: d.timestamp,
        }))
      );
    }

    if (analysis.importantMoments.length > 0) {
      await this.supabase.from("important_moments").insert(
        analysis.importantMoments.map((m) => ({
          meeting_id: meetingId,
          timestamp: m.timestamp,
          title: m.title,
          description: m.description,
        }))
      );
    }
  }
}
