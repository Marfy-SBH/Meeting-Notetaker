import Link from "next/link";
import { format } from "date-fns";
import { PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndWorkspace } from "@/lib/data/current";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlatformLabel } from "@/components/meetings/platform-label";
import { formatDuration } from "@/lib/utils";
import { meetingDateTime } from "@/lib/meeting-grouping";

export default async function RecordingsPage() {
  const { workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();

  const { data } = await supabase
    .from("meetings")
    .select("*, participants(*)")
    .eq("workspace_id", workspace.id)
    .not("recording_url", "is", null)
    .order("started_at", { ascending: false });

  const meetings = data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-foreground">Recordings</h1>

      {meetings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm font-medium text-foreground">No Recordings Yet</p>
            <p className="text-sm text-muted-foreground">Recordings from your meetings will appear here.</p>
            <Button size="sm" asChild>
              <Link href="/live">Start Meeting</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {meetings.map((m: any) => (
            <Link
              key={m.id}
              href={`/meetings/${m.id}`}
              className="flex items-center gap-4 rounded-card border border-border bg-card px-4 py-3.5 hover:border-primary/30 hover:bg-primary/[0.02]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <PlayCircle className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{m.title}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{format(meetingDateTime(m), "MMM d, yyyy · h:mm a")}</span>
                  {m.duration != null && <span>{formatDuration(m.duration)}</span>}
                  <PlatformLabel platform={m.platform} />
                  <span>{m.participants?.length ?? 0} participants</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
