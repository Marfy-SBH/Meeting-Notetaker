import { NextResponse } from "next/server";
import { SlackService } from "@/lib/services/slack-service";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const workspaceId = searchParams.get("state");
  if (!code || !workspaceId) return NextResponse.redirect(`${origin}/integrations?error=slack_auth_failed`);

  try {
    const slack = new SlackService();
    const tokens = await slack.exchangeCode(code);
    const supabase = await createClient();
    await supabase.from("integrations").upsert(
      {
        workspace_id: workspaceId,
        provider: "slack",
        status: "connected",
        access_token: tokens.access_token,
        settings: { team_name: tokens.team?.name },
      },
      { onConflict: "workspace_id,provider" }
    );
    return NextResponse.redirect(`${origin}/integrations?connected=slack`);
  } catch (err) {
    console.error(err);
    return NextResponse.redirect(`${origin}/integrations?error=slack_auth_failed`);
  }
}
