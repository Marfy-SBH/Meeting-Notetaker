import Link from "next/link";
import { Users2 } from "lucide-react";
import { PlatformLabel } from "@/components/meetings/platform-label";
import { StatusBadge } from "@/components/meetings/status-badge";
import { ScheduledMeetingDialog } from "@/components/meetings/scheduled-meeting-dialog";
import { formatDuration } from "@/lib/utils";
import { meetingDateTime, formatInAppTz } from "@/lib/meeting-grouping";
import type { Meeting, Participant } from "@/lib/types";

export function MeetingRow({ meeting }: { meeting: Meeting & { participants?: Participant[] } }) {
  const dt = meetingDateTime(meeting);

  const rowClassName =
    "flex w-full items-center justify-between gap-4 rounded-card border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-primary/30 hover:bg-primary/[0.02]";

  const rowBody = (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <p className="truncate text-sm font-medium text-foreground">{meeting.title}</p>
        <StatusBadge status={meeting.status} />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span>{formatInAppTz(dt, "h:mm a")}</span>
        {meeting.duration != null && <span>{formatDuration(meeting.duration)}</span>}
        {meeting.participants && meeting.participants.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Users2 className="h-3.5 w-3.5" /> {meeting.participants.length}
          </span>
        )}
        <PlatformLabel platform={meeting.platform} />
      </div>
    </div>
  );

  // A meeting that's still just scheduled hasn't happened yet — there's
  // nothing to show on its detail page, so open the schedule popup instead.
  if (meeting.status === "scheduled") {
    return (
      <ScheduledMeetingDialog
        meeting={meeting}
        trigger={
          <button type="button" className={rowClassName}>
            {rowBody}
          </button>
        }
      />
    );
  }

  return (
    <Link href={`/meetings/${meeting.id}`} className={rowClassName}>
      {rowBody}
    </Link>
  );
}
