import { format } from "date-fns";
import { Users2 } from "lucide-react";
import { PlatformLabel } from "@/components/meetings/platform-label";
import { StatusBadge } from "@/components/meetings/status-badge";
import { formatDuration } from "@/lib/utils";
import { meetingDateTime } from "@/lib/meeting-grouping";
import type { Meeting, Participant } from "@/lib/types";

export function MeetingHeader({ meeting }: { meeting: Meeting & { participants: Participant[] } }) {
  const start = meetingDateTime(meeting);
  const end = meeting.ended_at ? new Date(meeting.ended_at) : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-foreground">{meeting.title}</h1>
        <StatusBadge status={meeting.status} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>{format(start, "MMMM d, yyyy")}</span>
        <span>·</span>
        <span>
          {format(start, "h:mm a")}
          {end ? ` – ${format(end, "h:mm a")}` : ""}
        </span>
        {meeting.duration != null && (
          <>
            <span>·</span>
            <span>{formatDuration(meeting.duration)}</span>
          </>
        )}
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <Users2 className="h-3.5 w-3.5" /> {meeting.participants.length} participants
        </span>
        <span>·</span>
        <PlatformLabel platform={meeting.platform} />
      </div>
    </div>
  );
}
