"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Mic, Pencil } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/meetings/status-badge";
import { PlatformLabel } from "@/components/meetings/platform-label";
import { ScheduleMeetingDialog } from "@/components/calendar/schedule-meeting-dialog";
import { meetingDateTime, meetingEndDateTime } from "@/lib/meeting-grouping";
import type { Meeting, Participant } from "@/lib/types";

export function ScheduledMeetingDialog({
  meeting,
  trigger,
}: {
  meeting: Meeting & { participants?: Participant[] };
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const start = meetingDateTime(meeting);
  const end = meetingEndDateTime(meeting);

  return (
    <>
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>{meeting.title}</DialogTitle>
              <StatusBadge status={meeting.status} />
            </div>
            <DialogDescription>This meeting hasn&apos;t happened yet.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 text-sm">
            <InfoRow label="Date" value={format(start, "MMMM d, yyyy")} />
            <InfoRow label="Time" value={`${format(start, "h:mm a")} – ${format(end, "h:mm a")}`} />
            <InfoRow label="Platform" value={<PlatformLabel platform={meeting.platform} />} />
            <InfoRow
              label="Participants"
              value={
                <div className="flex flex-wrap justify-end gap-1">
                  {!meeting.participants?.length && "—"}
                  {meeting.participants?.map((p) => (
                    <Badge key={p.id} variant="outline">{p.name}</Badge>
                  ))}
                </div>
              }
            />
            {meeting.meeting_link && (
              <InfoRow
                label="Link"
                value={
                  <a
                    href={meeting.meeting_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open link
                  </a>
                }
              />
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            <Button
              variant="secondary"
              onClick={() => {
                setDetailsOpen(false);
                setEditOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button onClick={() => router.push(`/live?meetingId=${meeting.id}`)}>
              <Mic className="h-4 w-4" /> Start Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScheduleMeetingDialog meeting={meeting} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
