import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const supabase = await createClient();
  const like = `%${q}%`;

  const [meetingsByTitle, meetingsByParticipant, summaries, actionItems, decisions, transcripts] =
    await Promise.all([
      supabase.from("meetings").select("id, title, scheduled_date, started_at").ilike("title", like).limit(10),
      supabase
        .from("participants")
        .select("meeting_id, meetings(id, title, scheduled_date, started_at)")
        .ilike("name", like)
        .limit(10),
      supabase.from("summaries").select("meeting_id, summary, meetings(id, title, scheduled_date, started_at)").ilike("summary", like).limit(10),
      supabase
        .from("action_items")
        .select("meeting_id, task, meetings(id, title, scheduled_date, started_at)")
        .ilike("task", like)
        .limit(10),
      supabase
        .from("decisions")
        .select("meeting_id, text, meetings(id, title, scheduled_date, started_at)")
        .ilike("text", like)
        .limit(10),
      supabase
        .from("transcript_segments")
        .select("meeting_id, text, meetings(id, title, scheduled_date, started_at)")
        .ilike("text", like)
        .limit(10),
    ]);

  const byMeeting = new Map<string, any>();

  function addMatch(meeting: any, matchType: string, snippet?: string) {
    if (!meeting) return;
    const existing = byMeeting.get(meeting.id) ?? {
      id: meeting.id,
      title: meeting.title,
      date: meeting.scheduled_date ?? meeting.started_at,
      matches: [] as { type: string; snippet?: string }[],
    };
    if (!existing.matches.some((m: any) => m.type === matchType)) {
      existing.matches.push({ type: matchType, snippet });
    }
    byMeeting.set(meeting.id, existing);
  }

  meetingsByTitle.data?.forEach((m) => addMatch(m, "Title"));
  meetingsByParticipant.data?.forEach((p: any) => addMatch(p.meetings, "Participants"));
  summaries.data?.forEach((s: any) => {
    // "summary" is a JSON string ({bn, en}) — show whichever language actually matched.
    let snippet = s.summary;
    try {
      const parsed = JSON.parse(s.summary);
      snippet = [parsed.bn, parsed.en].find((v) => typeof v === "string" && v.toLowerCase().includes(q.toLowerCase())) ?? parsed.bn ?? parsed.en;
    } catch {
      // pre-existing plain-text summaries fall through unchanged
    }
    addMatch(s.meetings, "Summary", snippet);
  });
  actionItems.data?.forEach((a: any) => addMatch(a.meetings, "Action Items", a.task));
  decisions.data?.forEach((d: any) => addMatch(d.meetings, "Decisions", d.text));
  transcripts.data?.forEach((t: any) => addMatch(t.meetings, "Transcript", t.text));

  return NextResponse.json({ results: Array.from(byMeeting.values()).slice(0, 15) });
}
