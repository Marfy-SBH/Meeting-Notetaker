"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndWorkspace } from "@/lib/data/current";
import { revalidatePath } from "next/cache";
import { withPlainErrors } from "@/lib/errors";

interface DemoMeetingSeed {
  title: string;
  daysAgo: number;
  startHour: number;
  durationMin: number;
  platform: "in_app" | "zoom" | "google_meet";
  participants: string[];
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: { task: string; assignee: string; dueInDays: number }[];
  moments: { atMin: number; title: string; description: string }[];
  transcript: { speakerIdx: number; atSec: number; text: string }[];
}

const DEMO_MEETINGS: DemoMeetingSeed[] = [
  {
    title: "Product Design Review",
    daysAgo: 0,
    startHour: 16,
    durationMin: 48,
    platform: "zoom",
    participants: ["Maruf", "Sarah", "John", "Priya", "Alex", "Jamie", "Noor", "Dana"],
    summary:
      "The team discussed the product launch timeline, onboarding improvements, marketing preparation, and release requirements.",
    keyPoints: ["Product launch", "Onboarding", "Marketing", "Customer feedback"],
    decisions: ["Launch next Monday.", "Complete onboarding before release."],
    actionItems: [
      { task: "Complete onboarding design", assignee: "John", dueInDays: 2 },
      { task: "Review UX", assignee: "Sarah", dueInDays: 1 },
    ],
    moments: [
      { atMin: 12, title: "Launch date decision", description: "Team agreed on next Monday." },
      { atMin: 25, title: "Onboarding task assigned", description: "John to own onboarding redesign." },
    ],
    transcript: [
      { speakerIdx: 0, atSec: 134, text: "We should launch the new version next week." },
      { speakerIdx: 1, atSec: 182, text: "Before that, we need to finish the onboarding flow." },
    ],
  },
  {
    title: "Marketing Strategy",
    daysAgo: 0,
    startHour: 11,
    durationMin: 35,
    platform: "in_app",
    participants: ["Priya", "Alex", "Dana"],
    summary: "Reviewed Q3 campaign performance and aligned on messaging for the upcoming launch.",
    keyPoints: ["Campaign performance", "Launch messaging", "Budget allocation"],
    decisions: ["Increase paid social budget by 20% for launch week."],
    actionItems: [{ task: "Draft launch announcement copy", assignee: "Dana", dueInDays: 3 }],
    moments: [{ atMin: 9, title: "Budget increase approved", description: "20% increase for launch week." }],
    transcript: [{ speakerIdx: 0, atSec: 90, text: "Our paid social numbers were strong last quarter." }],
  },
  {
    title: "Engineering Sync",
    daysAgo: 1,
    startHour: 10,
    durationMin: 32,
    platform: "google_meet",
    participants: ["Maruf", "Noor", "Jamie"],
    summary: "Discussed current sprint blockers and the plan for the upcoming infrastructure migration.",
    keyPoints: ["Sprint blockers", "Infra migration plan", "On-call rotation"],
    decisions: ["Migration will happen over the weekend to minimize downtime."],
    actionItems: [{ task: "Prepare migration rollback plan", assignee: "Jamie", dueInDays: 4 }],
    moments: [{ atMin: 14, title: "Migration timing decided", description: "Scheduled for the weekend." }],
    transcript: [{ speakerIdx: 0, atSec: 60, text: "The main blocker is the database migration." }],
  },
  {
    title: "Weekly Planning",
    daysAgo: 2,
    startHour: 14,
    durationMin: 45,
    platform: "in_app",
    participants: ["Maruf", "Sarah", "Priya", "Noor"],
    summary: "Set priorities for the week across engineering, design, and marketing.",
    keyPoints: ["Weekly priorities", "Cross-team dependencies"],
    decisions: ["Design will front-load onboarding work this week."],
    actionItems: [{ task: "Share updated roadmap with stakeholders", assignee: "Maruf", dueInDays: 2 }],
    moments: [{ atMin: 20, title: "Priority realignment", description: "Onboarding moved to top priority." }],
    transcript: [{ speakerIdx: 0, atSec: 45, text: "Let's lock in priorities for this week." }],
  },
  {
    title: "Client Feedback",
    daysAgo: 4,
    startHour: 13,
    durationMin: 40,
    platform: "zoom",
    participants: ["Sarah", "Alex"],
    summary: "Walked through client feedback on the latest release and prioritized fixes.",
    keyPoints: ["Client feedback themes", "Bug prioritization"],
    decisions: ["Top 3 reported issues will be fixed before next release."],
    actionItems: [{ task: "File tickets for top client-reported bugs", assignee: "Alex", dueInDays: 1 }],
    moments: [{ atMin: 8, title: "Top issues identified", description: "Three recurring bugs called out." }],
    transcript: [{ speakerIdx: 0, atSec: 30, text: "The client flagged three issues in the latest release." }],
  },
  {
    title: "Team Standup",
    daysAgo: 6,
    startHour: 9,
    durationMin: 15,
    platform: "in_app",
    participants: ["Maruf", "Sarah", "John", "Priya", "Noor"],
    summary: "Quick round of updates — no blockers reported across the team.",
    keyPoints: ["Status updates", "No blockers"],
    decisions: [],
    actionItems: [],
    moments: [],
    transcript: [{ speakerIdx: 0, atSec: 20, text: "No blockers on my end, moving fast on the new feature." }],
  },
];

export const seedDemoData = withPlainErrors(async function seedDemoData() {
  const { user, workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();

  for (const seed of DEMO_MEETINGS) {
    const start = new Date();
    start.setDate(start.getDate() - seed.daysAgo);
    start.setHours(seed.startHour, 0, 0, 0);
    const end = new Date(start.getTime() + seed.durationMin * 60_000);

    const { data: meeting, error } = await supabase
      .from("meetings")
      .insert({
        workspace_id: workspace.id,
        created_by: user.id,
        title: seed.title,
        platform: seed.platform,
        status: "completed",
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        duration: seed.durationMin * 60,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        processing_step: "done",
      })
      .select()
      .single();

    if (error || !meeting) continue;

    await supabase.from("participants").insert(
      seed.participants.map((name) => ({ meeting_id: meeting.id, name, email: `${name.toLowerCase()}@demo.local` }))
    );

    // Demo data is illustrative only — bn/en both carry the same English seed
    // text rather than a genuine translation.
    await supabase.from("summaries").insert({
      meeting_id: meeting.id,
      summary: JSON.stringify({ bn: seed.summary, en: seed.summary }),
      key_points: { bn: seed.keyPoints, en: seed.keyPoints },
      decisions: seed.decisions,
    });

    const minutesContent = {
      agenda: seed.keyPoints,
      discussion: seed.summary,
      decisions: seed.decisions,
      actionItems: seed.actionItems.map((a) => a.task),
    };
    await supabase.from("meeting_minutes").insert({
      meeting_id: meeting.id,
      content: { bn: minutesContent, en: minutesContent },
    });

    if (seed.actionItems.length > 0) {
      await supabase.from("action_items").insert(
        seed.actionItems.map((a) => ({
          meeting_id: meeting.id,
          task: a.task,
          assignee: a.assignee,
          due_date: new Date(Date.now() + a.dueInDays * 86_400_000).toISOString().slice(0, 10),
          status: "pending",
        }))
      );
    }

    if (seed.decisions.length > 0) {
      await supabase.from("decisions").insert(
        seed.decisions.map((text, i) => ({ meeting_id: meeting.id, text, timestamp: i === 0 ? 60 : null }))
      );
    }

    if (seed.moments.length > 0) {
      await supabase.from("important_moments").insert(
        seed.moments.map((m) => ({
          meeting_id: meeting.id,
          timestamp: m.atMin * 60,
          title: m.title,
          description: m.description,
        }))
      );
    }

    if (seed.transcript.length > 0) {
      await supabase.from("transcript_segments").insert(
        seed.transcript.map((t) => ({
          meeting_id: meeting.id,
          speaker: seed.participants[t.speakerIdx] ?? "Speaker 1",
          start_time: t.atSec,
          end_time: t.atSec + 4,
          text: t.text,
        }))
      );
    }
  }

  await supabase.from("notifications").insert({
    user_id: user.id,
    type: "summary_ready",
    title: "Meeting summary is ready",
    message: `Notes for "${DEMO_MEETINGS[0].title}" are ready to review.`,
  });

  revalidatePath("/", "layout");
});
