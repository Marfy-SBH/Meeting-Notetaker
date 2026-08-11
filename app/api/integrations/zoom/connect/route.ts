import { NextResponse } from "next/server";
import { ZoomService } from "@/lib/services/zoom-service";
import { getCurrentUserAndWorkspace } from "@/lib/data/current";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const zoom = new ZoomService();
  if (!zoom.isConfigured()) {
    return NextResponse.redirect(`${origin}/integrations?error=zoom_not_configured`);
  }
  const { workspace } = await getCurrentUserAndWorkspace();
  return NextResponse.redirect(zoom.getAuthUrl(workspace.id));
}
