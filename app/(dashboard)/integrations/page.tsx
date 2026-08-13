import { Calendar, Video, MessageSquare as SlackIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndWorkspace } from "@/lib/data/current";
import { IntegrationCard } from "@/components/integrations/integration-card";
import { AiConfigCard } from "@/components/integrations/ai-config-card";
import { ZoomService } from "@/lib/services/zoom-service";
import { SlackService } from "@/lib/services/slack-service";
import type { AiConfig, Integration, IntegrationProvider } from "@/lib/types";

export default async function IntegrationsPage() {
  const { user, workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();

  const [{ data }, { data: profile }] = await Promise.all([
    // Regular members can't read access_token/refresh_token directly (see
    // 0006_integrations_token_security.sql) — this RPC hands back only the
    // fields the UI actually needs (status/settings), never the raw tokens.
    supabase.rpc("get_workspace_integrations", { p_workspace_id: workspace.id }),
    supabase.from("profiles").select("settings").eq("id", user.id).single(),
  ]);
  const integrations = (data ?? []) as Omit<Integration, "access_token" | "refresh_token">[];
  const savedAiConfig: AiConfig = (profile?.settings as any)?.aiConfig ?? { provider: null, apiKey: null };
  // Never send the raw key to the client — only whether one is set.
  const aiConfig = { provider: savedAiConfig.provider, hasKey: Boolean(savedAiConfig.apiKey) };

  const byProvider = (provider: IntegrationProvider) => integrations.find((i) => i.provider === provider);

  const zoom = new ZoomService();
  const slack = new SlackService();

  const googleIntegration = byProvider("google_calendar");
  const zoomIntegration = byProvider("zoom");
  const slackIntegration = byProvider("slack");

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-foreground">Integrations</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">AI Configuration</h2>
          <AiConfigCard aiConfig={aiConfig} />
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground">Software Connections</h2>
          <div className="flex flex-col gap-4">
            <IntegrationCard
              provider="google_calendar"
              icon={<Calendar className="h-5 w-5 text-primary" />}
              name="Google Calendar"
              description="Schedule, manage, and receive reminders for your meetings."
              connected={googleIntegration?.status === "connected"}
              demo={Boolean((googleIntegration as any)?.settings?.demo)}
              configured={Boolean(process.env.GOOGLE_CLIENT_ID)}
              connectHref="/api/integrations/google/connect"
              settingsSchema={[]}
              settings={(googleIntegration as any)?.settings ?? {}}
            />

            <IntegrationCard
              provider="zoom"
              icon={<Video className="h-5 w-5 text-primary" />}
              name="Zoom"
              description="Connect your Zoom account to manage and capture supported Zoom meetings."
              connected={zoomIntegration?.status === "connected"}
              demo={Boolean((zoomIntegration as any)?.settings?.demo) || !zoom.isConfigured()}
              configured={zoom.isConfigured()}
              connectHref="/api/integrations/zoom/connect"
              settingsSchema={[
                { key: "autoDetect", label: "Automatically detect Zoom meetings" },
                { key: "processRecordings", label: "Process meeting recordings" },
                { key: "generateTranscripts", label: "Generate transcripts" },
                { key: "generateSummaries", label: "Generate summaries" },
                { key: "extractActionItems", label: "Extract action items" },
              ]}
              settings={(zoomIntegration as any)?.settings ?? {}}
            />

            <IntegrationCard
              provider="slack"
              icon={<SlackIcon className="h-5 w-5 text-primary" />}
              name="Slack"
              description="Connect your Slack workspace to manage supported Slack meeting/huddle activity."
              connected={slackIntegration?.status === "connected"}
              demo={Boolean((slackIntegration as any)?.settings?.demo) || !slack.isConfigured()}
              configured={slack.isConfigured()}
              connectHref="/api/integrations/slack/connect"
              settingsSchema={[
                { key: "captureHuddles", label: "Capture supported huddles" },
                { key: "generateSummaries", label: "Generate summaries" },
                { key: "generateActionItems", label: "Generate action items" },
              ]}
              settings={(slackIntegration as any)?.settings ?? {}}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Zoom cannot capture meeting audio automatically — recordings are processed once Zoom reports a cloud
            recording is available for a connected meeting. Slack has no public API for automatic huddle audio
            capture; connecting Slack enables workspace-level summaries for content Slack itself exposes.
          </p>
        </div>
      </div>
    </div>
  );
}
