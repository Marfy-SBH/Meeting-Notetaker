import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlatformLabel } from "@/components/meetings/platform-label";
import { formatDuration, formatTimer } from "@/lib/utils";
import { meetingDateTime } from "@/lib/meeting-grouping";
import type { MeetingWithRelations } from "@/lib/types";

export function OverviewTab({ meeting }: { meeting: MeetingWithRelations }) {
  const start = meetingDateTime(meeting);
  const end = meeting.ended_at ? new Date(meeting.ended_at) : null;
  const keyPoints = meeting.summary?.key_points?.bn ?? [];
  const decisions = meeting.decisions ?? [];
  const actionItems = meeting.action_items ?? [];

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Meeting Information</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <InfoRow label="Date" value={format(start, "MMMM d, yyyy")} />
          <InfoRow label="Start time" value={format(start, "h:mm a")} />
          <InfoRow label="End time" value={end ? format(end, "h:mm a") : "—"} />
          <InfoRow label="Duration" value={meeting.duration != null ? formatDuration(meeting.duration) : "—"} />
          <InfoRow label="Platform" value={<PlatformLabel platform={meeting.platform} />} />
          <InfoRow
            label="Participants"
            value={
              <div className="flex flex-wrap gap-1">
                {meeting.participants.length === 0 && "—"}
                {meeting.participants.map((p) => (
                  <Badge key={p.id} variant="outline">{p.name}</Badge>
                ))}
              </div>
            }
          />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-5 lg:col-span-2">
        <Card>
          <CardHeader><CardTitle>Key Highlights</CardTitle></CardHeader>
          <CardContent>
            {keyPoints.length === 0 ? (
              <EmptySection text="Key discussion points will appear here once processing finishes." />
            ) : (
              <ul className="flex flex-col gap-2 text-sm text-foreground">
                {keyPoints.map((k, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {k}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Decisions</CardTitle></CardHeader>
          <CardContent>
            {decisions.length === 0 ? (
              <EmptySection text="No decisions detected yet." />
            ) : (
              <ol className="flex flex-col gap-2 text-sm text-foreground">
                {decisions.map((d, i) => (
                  <li key={d.id} className="flex gap-2">
                    <span className="font-medium text-muted-foreground">{i + 1}.</span>
                    <span>
                      {d.text}
                      {d.timestamp != null && (
                        <span className="ml-2 text-xs font-medium text-primary">{formatTimer(d.timestamp)}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Action Items</CardTitle></CardHeader>
          <CardContent>
            {actionItems.length === 0 ? (
              <EmptySection text="No action items detected yet." />
            ) : (
              <ul className="flex flex-col gap-2 text-sm text-foreground">
                {actionItems.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span>{a.task}</span>
                    <span className="text-xs text-muted-foreground">{a.assignee ?? "Unassigned"}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
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

function EmptySection({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}
