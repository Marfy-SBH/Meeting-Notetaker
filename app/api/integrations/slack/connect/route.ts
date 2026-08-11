import { NextResponse } from "next/server";
import { SlackService } from "@/lib/services/slack-service";
import { getCurrentUserAndWorkspace } from "@/lib/data/current";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const slack = new SlackService();
  if (!slack.isConfigured()) {
    return NextResponse.redirect(`${origin}/integrations?error=slack_not_configured`);
  }
  const { workspace } = await getCurrentUserAndWorkspace();
  return NextResponse.redirect(slack.getAuthUrl(workspace.id));
}
