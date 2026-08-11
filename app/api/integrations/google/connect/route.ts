import { NextResponse } from "next/server";
import { GoogleCalendarService } from "@/lib/services/google-calendar-service";
import { getCurrentUserAndWorkspace } from "@/lib/data/current";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.redirect(`${origin}/integrations?error=google_not_configured`);
  }

  const { workspace } = await getCurrentUserAndWorkspace();
  const google = new GoogleCalendarService();
  const url = google.getAuthUrl(workspace.id);
  return NextResponse.redirect(url);
}
