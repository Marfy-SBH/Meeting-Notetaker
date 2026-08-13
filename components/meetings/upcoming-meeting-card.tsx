import Link from "next/link";
import { format } from "date-fns";
import { Users2 } from "lucide-react";
import { PlatformLabel } from "@/components/meetings/platform-label";
import { StatusBadge } from "@/components/meetings/status-badge";
import { ScheduledMeetingDialog } from "@/components/meetings/scheduled-meeting-dialog";
import { meetingDateTime } from "@/lib/meeting-grouping";
import type { Meeting, Participant } from "@/lib/types";

export function UpcomingMeetingCard({ meeting }: { meeting: Meeting & { participants?: Participant[] } }) {
  const dt = meetingDateTime(meeting);

  const cardBody = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{format(dt, "EEE, MMM d")}</span>
        <StatusBadge status={meeting.status} />
      </div>
      <p className="line-clamp-2 text-sm font-medium text-foreground">{meeting.title}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{format(dt, "h:mm a")}</span>
        {meeting.participants && meeting.participants.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Users2 className="h-3.5 w-3.5" /> {meeting.participants.length}
          </span>
        )}
        <PlatformLabel platform={meeting.platform} />
      </div>
    </>
  );

  const cardClassName =
    "flex w-64 shrink-0 cursor-pointer flex-col gap-3 rounded-card border border-border bg-card p-4 text-left transition-colors hover:border-primary/30 hover:bg-primary/[0.02]";

  // A meeting that's still just scheduled hasn't happened yet — there's
  // nothing to show on its detail page, so open the schedule popup instead.
  if (meeting.status === "scheduled") {
    return (
      <ScheduledMeetingDialog
        meeting={meeting}
        trigger={
          <button type="button" className={cardClassName}>
            {cardBody}
          </button>
        }
      />
    );
  }

  return (
    <Link href={`/meetings/${meeting.id}`} className={cardClassName}>
      {cardBody}
    </Link>
  );
}
