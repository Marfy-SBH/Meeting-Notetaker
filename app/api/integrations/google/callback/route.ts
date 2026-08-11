import { NextResponse } from "next/server";
import { GoogleCalendarService } from "@/lib/services/google-calendar-service";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const workspaceId = searchParams.get("state");

  if (!code || !workspaceId) {
    return NextResponse.redirect(`${origin}/integrations?error=google_auth_failed`);
  }

  try {
    const google = new GoogleCalendarService();
    const tokens = await google.exchangeCode(code);
    const supabase = await createClient();

    await supabase.from("integrations").upsert(
      {
        workspace_id: workspaceId,
        provider: "google_calendar",
        status: "connected",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        settings: { expiry_date: tokens.expiry_date },
      },
      { onConflict: "workspace_id,provider" }
    );

    return NextResponse.redirect(`${origin}/calendar?connected=1`);
  } catch (err) {
    console.error(err);
    return NextResponse.redirect(`${origin}/integrations?error=google_auth_failed`);
  }
}
