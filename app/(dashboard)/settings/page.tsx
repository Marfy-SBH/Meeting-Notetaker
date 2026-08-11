import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndWorkspace } from "@/lib/data/current";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { SettingsToggleRow } from "@/components/settings/settings-toggle-row";
import { SettingsSelectRow } from "@/components/settings/settings-select-row";
import { updateProfile, updateWorkspaceName } from "@/lib/actions/settings";
import { SendResetButton } from "@/components/settings/send-reset-button";

export default async function SettingsPage() {
  const { user, profile, workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();

  const { data: googleIntegration } = await supabase
    .from("integrations")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("provider", "google_calendar")
    .maybeSingle();

  const settings = profile?.settings ?? {};

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">Settings</h1>

      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent>
          <form action={updateProfile} className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Avatar name={profile?.name ?? "You"} src={profile?.avatar_url} size="lg" />
              <div>
                <p className="text-sm font-medium text-foreground">{profile?.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={profile?.name ?? ""} />
            </div>
            <Button type="submit" size="sm" className="self-start">Save</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Workspace</CardTitle></CardHeader>
        <CardContent>
          <form action={updateWorkspaceName} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workspaceName">Workspace name</Label>
              <Input id="workspaceName" name="workspaceName" defaultValue={workspace?.name ?? ""} />
            </div>
            <Button type="submit" size="sm" className="self-start">Save</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recording</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SettingsSelectRow
            section="recording"
            field="quality"
            label="Recording quality"
            defaultValue={settings.recording?.quality ?? "standard"}
            options={[{ value: "standard", label: "Standard" }, { value: "high", label: "High" }]}
          />
          <SettingsToggleRow
            section="recording"
            field="autoRecording"
            label="Auto recording on join"
            defaultChecked={settings.recording?.autoRecording ?? false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>AI</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SettingsSelectRow
            section="ai"
            field="summaryLength"
            label="Summary length"
            defaultValue={settings.ai?.summaryLength ?? "standard"}
            options={[{ value: "brief", label: "Brief" }, { value: "standard", label: "Standard" }, { value: "detailed", label: "Detailed" }]}
          />
          <SettingsSelectRow
            section="ai"
            field="language"
            label="Language"
            defaultValue={settings.ai?.language ?? "auto"}
            options={[{ value: "auto", label: "Auto-detect" }, { value: "en", label: "English" }, { value: "bn", label: "Bangla" }]}
          />
          <SettingsToggleRow
            section="ai"
            field="speakerDetection"
            label="Speaker detection"
            defaultChecked={settings.ai?.speakerDetection ?? true}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SettingsToggleRow
            section="notifications"
            field="meetingReminders"
            label="Meeting reminders"
            defaultChecked={settings.notifications?.meetingReminders ?? true}
          />
          <SettingsToggleRow
            section="notifications"
            field="summaryReady"
            label="Summary ready"
            defaultChecked={settings.notifications?.summaryReady ?? true}
          />
          <SettingsToggleRow
            section="notifications"
            field="actionItemReminders"
            label="Action item reminders"
            defaultChecked={settings.notifications?.actionItemReminders ?? true}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Calendar</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">Google Calendar</p>
            <p className="text-xs text-muted-foreground">
              {googleIntegration?.status === "connected" ? "Connected" : "Not connected"}
            </p>
          </div>
          <Button size="sm" variant="secondary" asChild>
            <Link href="/calendar">Manage</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Integrations</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Zoom, Slack, and Google Calendar connections.</p>
          <Button size="sm" variant="secondary" asChild>
            <Link href="/integrations">Manage</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Security</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Password</p>
              <p className="text-xs text-muted-foreground">Send yourself a reset link by email.</p>
            </div>
            <SendResetButton email={user.email ?? ""} />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div>
              <p className="text-sm text-danger">Delete account</p>
              <p className="text-xs text-muted-foreground">Permanently remove your account and all meetings.</p>
            </div>
            <Badge variant="outline">Contact support</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
