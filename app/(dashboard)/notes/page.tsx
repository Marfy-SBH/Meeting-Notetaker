import Link from "next/link";
import { format } from "date-fns";
import { FileText, ListChecks, Gavel } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndWorkspace } from "@/lib/data/current";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { groupMeetingsByDate, meetingDateTime } from "@/lib/meeting-grouping";

export default async function NotesPage() {
  const { workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();

  const { data } = await supabase
    .from("meetings")
    .select("*, summaries(id), meeting_minutes(id), action_items(id), decisions(id)")
    .eq("workspace_id", workspace.id)
    .eq("status", "completed")
    .order("started_at", { ascending: false });

  const meetings = data ?? [];
  const groups = groupMeetingsByDate(meetings as any);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-foreground">Notes</h1>

      {meetings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm font-medium text-foreground">No Notes Yet</p>
            <p className="text-sm text-muted-foreground">
              AI-generated notes will show up here after your first meeting is processed.
            </p>
            <Button size="sm" asChild>
              <Link href="/live">Start Meeting</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                {group.label === format(new Date(), "MMMM d") ? "Today's Notes" : `${group.label}'s Notes`}
              </p>
              <div className="flex flex-col gap-2">
                {group.items.map((m: any) => (
                  <Link
                    key={m.id}
                    href={`/meetings/${m.id}`}
                    className="flex flex-col gap-2 rounded-card border border-border bg-card px-4 py-3.5 hover:border-primary/30 hover:bg-primary/[0.02] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.title}</p>
                      <p className="text-xs text-muted-foreground">{format(meetingDateTime(m), "MMM d · h:mm a")}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {m.summaries?.length > 0 && <Badge variant="outline"><FileText className="h-3 w-3" /> Summary</Badge>}
                      {m.meeting_minutes?.length > 0 && <Badge variant="outline"><FileText className="h-3 w-3" /> Minutes</Badge>}
                      {m.action_items?.length > 0 && (
                        <Badge variant="primary"><ListChecks className="h-3 w-3" /> {m.action_items.length} Action Items</Badge>
                      )}
                      {m.decisions?.length > 0 && (
                        <Badge variant="success"><Gavel className="h-3 w-3" /> {m.decisions.length} Decisions</Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
