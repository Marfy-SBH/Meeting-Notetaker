import Link from "next/link";
import { format } from "date-fns";
import { Mic, CalendarPlus, CalendarClock, Clock, ListChecks, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndWorkspace } from "@/lib/data/current";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MeetingRow } from "@/components/meetings/meeting-row";
import { UpcomingMeetingCard } from "@/components/meetings/upcoming-meeting-card";
import { ScheduleMeetingDialog } from "@/components/calendar/schedule-meeting-dialog";
import { SeedDemoButton } from "@/components/dashboard/seed-demo-button";
import { groupMeetingsByDate, isUpcoming, meetingDateTime } from "@/lib/meeting-grouping";
import { formatDuration } from "@/lib/utils";
import type { Meeting, Participant } from "@/lib/types";

export default async function DashboardPage() {
  const { workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();

  const { data: meetings } = await supabase
    .from("meetings")
    .select("*, participants(*)")
    .eq("workspace_id", workspace.id)
    .order("started_at", { ascending: false, nullsFirst: false });

  const all = (meetings ?? []) as (Meeting & { participants: Participant[] })[];
  const upcoming = all.filter(isUpcoming).sort((a, b) => meetingDateTime(a).getTime() - meetingDateTime(b).getTime());
  const completed = all.filter((m) => m.status === "completed");
  const totalDurationSec = completed.reduce((sum, m) => sum + (m.duration ?? 0), 0);

  const { count: actionItemsTotal } = await supabase
    .from("action_items")
    .select("id, meetings!inner(workspace_id)", { count: "exact", head: true })
    .eq("meetings.workspace_id", workspace.id);
  const { count: actionItemsPending } = await supabase
    .from("action_items")
    .select("id, meetings!inner(workspace_id)", { count: "exact", head: true })
    .eq("meetings.workspace_id", workspace.id)
    .eq("status", "pending");

  const todayUpcoming = upcoming.filter((m) => format(new Date(m.scheduled_date ?? m.started_at ?? m.created_at), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"));
  const recentGroups = groupMeetingsByDate(all.filter((m) => m.status === "completed" || m.status === "processing" || m.status === "failed")).slice(0, 3);

  const kpis = [
    { label: "Meetings", value: String(all.length), sub: `${completed.length} completed`, icon: CalendarDays },
    { label: "Meeting Hours", value: formatDuration(totalDurationSec), sub: "total recorded", icon: Clock },
    { label: "Action Items", value: String(actionItemsTotal ?? 0), sub: `${actionItemsPending ?? 0} pending`, icon: ListChecks },
    { label: "Upcoming", value: String(upcoming.length), sub: `${todayUpcoming.length} today`, icon: CalendarClock },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent">
        <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Start a New Meeting</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Record your meeting and let AI organize the notes after it&apos;s finished.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <ScheduleMeetingDialog
              trigger={
                <Button variant="secondary">
                  <CalendarPlus className="h-4 w-4" /> Schedule Meeting
                </Button>
              }
            />
            <Button asChild>
              <Link href="/live">
                <Mic className="h-4 w-4" /> Start Meeting
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-card bg-primary/[0.06] p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((k) => (
            <Card key={k.label}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
                  <k.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-2xl font-semibold text-foreground">{k.value}</span>
                <span className="text-xs text-muted-foreground">{k.sub}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Upcoming Meetings</h2>
          <Link href="/meetings" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <EmptyMeetings />
        ) : (
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {upcoming.map((m) => (
              <UpcomingMeetingCard key={m.id} meeting={m} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent Meetings</h2>
          <Link href="/meetings" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        {recentGroups.length === 0 ? (
          <EmptyMeetings />
        ) : (
          <div className="flex flex-col gap-4">
            {recentGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                  {group.label}
                </p>
                <div className="flex flex-col gap-2">
                  {group.items.map((m) => (
                    <MeetingRow key={m.id} meeting={m} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyMeetings() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm font-medium text-foreground">No Meetings Yet</p>
        <p className="text-sm text-muted-foreground">
          Start your first meeting and let AI take care of the notes after it&apos;s finished.
        </p>
        <div className="flex gap-2">
          <Button size="sm" asChild>
            <Link href="/live">Start Meeting</Link>
          </Button>
          <SeedDemoButton />
        </div>
      </CardContent>
    </Card>
  );
}
