import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleCalendarService, type GoogleCalendarEventInput } from "@/lib/services/google-calendar-service";

// Provider-agnostic calendar sync. Only Google is wired up today; a future
// provider drops in beside GoogleCalendarService without touching callers.
export class CalendarService {
  private google = new GoogleCalendarService();

  constructor(private supabase: SupabaseClient) {}

  async getConnection(workspaceId: string) {
    const { data } = await this.supabase
      .from("integrations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("provider", "google_calendar")
      .eq("status", "connected")
      .maybeSingle();
    return data;
  }

  private async getValidAccessToken(workspaceId: string): Promise<string | null> {
    const integration = await this.getConnection(workspaceId);
    if (!integration?.access_token) return null;

    const settings = integration.settings ?? {};
    if (settings.expiry_date && Date.now() > settings.expiry_date - 60_000 && integration.refresh_token) {
      const refreshed = await this.google.refreshToken(integration.refresh_token);
      await this.supabase
        .from("integrations")
        .update({
          access_token: refreshed.access_token,
          settings: { ...settings, expiry_date: refreshed.expiry_date },
        })
        .eq("id", integration.id);
      return refreshed.access_token;
    }
    return integration.access_token;
  }

  async listEvents(workspaceId: string, timeMin: Date, timeMax: Date) {
    const token = await this.getValidAccessToken(workspaceId);
    if (!token) return [];
    try {
      return await this.google.listEvents(token, timeMin.toISOString(), timeMax.toISOString());
    } catch (err) {
      console.error("Calendar sync error", err);
      return [];
    }
  }

  async syncMeetingToGoogle(workspaceId: string, meetingId: string, event: GoogleCalendarEventInput) {
    const token = await this.getValidAccessToken(workspaceId);
    if (!token) return null;

    const created = await this.google.createEvent(token, event);

    await this.supabase.from("calendar_events").insert({
      meeting_id: meetingId,
      workspace_id: workspaceId,
      provider: "google",
      external_event_id: created.id,
      calendar_id: "primary",
      start_time: event.startTime,
      end_time: event.endTime,
      timezone: event.timezone,
      sync_status: "synced",
    });

    return created;
  }
}
