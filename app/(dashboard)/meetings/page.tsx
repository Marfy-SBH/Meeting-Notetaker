import Link from "next/link";
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndWorkspace } from "@/lib/data/current";
import { MeetingsFilters } from "@/components/meetings/meetings-filters";
import { MeetingsCalendarView } from "@/components/meetings/meetings-calendar-view";
import { MeetingRow } from "@/components/meetings/meeting-row";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { groupMeetingsByDate, meetingDateTime } from "@/lib/meeting-grouping";
import type { Meeting, Participant } from "@/lib/types";

function rangeBounds(range: string | undefined) {
  const now = new Date();
  switch (range) {
    case "today":
      return [startOfDay(now), endOfDay(now)];
    case "yesterday":
      return [startOfDay(subDays(now, 1)), endOfDay(subDays(now, 1))];
    case "week":
      return [startOfWeek(now), endOfWeek(now)];
    case "month":
      return [startOfMonth(now), endOfMonth(now)];
    default:
      return null;
  }
}

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: { view?: string; range?: string; status?: string; platform?: string };
}) {
  const { workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();

  let query = supabase.from("meetings").select("*, participants(*)").eq("workspace_id", workspace.id);
  if (searchParams.status) query = query.eq("status", searchParams.status);
  if (searchParams.platform) query = query.eq("platform", searchParams.platform);

  const { data } = await query;
  let meetings = (data ?? []) as (Meeting & { participants: Participant[] })[];

  const bounds = rangeBounds(searchParams.range);
  if (bounds) {
    const [start, end] = bounds;
    meetings = meetings.filter((m) => {
      const dt = meetingDateTime(m);
      return dt >= start && dt <= end;
    });
  }

  meetings = meetings.sort((a, b) => meetingDateTime(b).getTime() - meetingDateTime(a).getTime());
  const view = searchParams.view === "calendar" ? "calendar" : "list";
  const groups = groupMeetingsByDate(meetings);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Meetings</h1>
        <Button asChild size="sm">
          <Link href="/live">Start Meeting</Link>
        </Button>
      </div>

      <MeetingsFilters view={view} />

      {meetings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm font-medium text-foreground">No Meetings Yet</p>
            <p className="text-sm text-muted-foreground">
              Start your first meeting and let AI take care of the notes after it&apos;s finished.
            </p>
            <Button size="sm" asChild>
              <Link href="/live">Start Meeting</Link>
            </Button>
          </CardContent>
        </Card>
      ) : view === "calendar" ? (
        <MeetingsCalendarView meetings={meetings} />
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
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
    </div>
  );
}
