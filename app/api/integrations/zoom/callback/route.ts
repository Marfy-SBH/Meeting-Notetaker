import { NextResponse } from "next/server";
import { ZoomService } from "@/lib/services/zoom-service";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const workspaceId = searchParams.get("state");
  if (!code || !workspaceId) return NextResponse.redirect(`${origin}/integrations?error=zoom_auth_failed`);

  try {
    const zoom = new ZoomService();
    const tokens = await zoom.exchangeCode(code);
    const supabase = await createClient();
    await supabase.from("integrations").upsert(
      {
        workspace_id: workspaceId,
        provider: "zoom",
        status: "connected",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        settings: { expiry_date: tokens.expiry_date },
      },
      { onConflict: "workspace_id,provider" }
    );
    return NextResponse.redirect(`${origin}/integrations?connected=zoom`);
  } catch (err) {
    console.error(err);
    return NextResponse.redirect(`${origin}/integrations?error=zoom_auth_failed`);
  }
}
