import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndWorkspace } from "@/lib/data/current";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScheduleMeetingDialog } from "@/components/calendar/schedule-meeting-dialog";
import { CalendarView } from "@/components/calendar/calendar-view";

export default async function CalendarPage() {
  const { workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();

  const { data: integration } = await supabase
    .from("integrations")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("provider", "google_calendar")
    .maybeSingle();

  const connected = integration?.status === "connected";

  const { data: meetings } = await supabase
    .from("meetings")
    .select("*")
    .eq("workspace_id", workspace.id)
    .neq("status", "cancelled");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Calendar</h1>
        <ScheduleMeetingDialog />
      </div>

      {!connected && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CalendarClock className="h-6 w-6" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Connect Google Calendar</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Connect your Google Calendar to schedule, manage, and receive reminders for your meetings.
            </p>
            <Button asChild>
              <a href="/api/integrations/google/connect">Connect Google Calendar</a>
            </Button>
          </CardContent>
        </Card>
      )}

      <CalendarView meetings={meetings ?? []} />
    </div>
  );
}
