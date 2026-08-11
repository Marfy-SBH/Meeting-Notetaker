// Thin REST wrapper around the Google Calendar API — no SDK dependency, so
// swapping calendar providers later means replacing this one file.
const AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API_BASE = "https://www.googleapis.com/calendar/v3";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "openid", "email", "profile"];

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

export interface GoogleCalendarEventInput {
  title: string;
  description?: string;
  startTime: string; // ISO
  endTime: string; // ISO
  timezone: string;
  attendees?: { email: string }[];
  location?: string;
}

export class GoogleCalendarService {
  getAuthUrl(state: string) {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES.join(" "),
      state,
    });
    return `${AUTH_BASE}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<GoogleTokens> {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
    const data = await res.json();
    return { ...data, expiry_date: Date.now() + data.expires_in * 1000 };
  }

  async refreshToken(refreshToken: string): Promise<GoogleTokens> {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
    const data = await res.json();
    return { access_token: data.access_token, refresh_token: refreshToken, expiry_date: Date.now() + data.expires_in * 1000 };
  }

  async listEvents(accessToken: string, timeMin: string, timeMax: string) {
    const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime" });
    const res = await fetch(`${API_BASE}/calendars/primary/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Google Calendar list events failed: ${await res.text()}`);
    const data = await res.json();
    return data.items ?? [];
  }

  async createEvent(accessToken: string, event: GoogleCalendarEventInput) {
    const res = await fetch(`${API_BASE}/calendars/primary/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: event.title,
        description: event.description,
        location: event.location,
        start: { dateTime: event.startTime, timeZone: event.timezone },
        end: { dateTime: event.endTime, timeZone: event.timezone },
        attendees: event.attendees,
      }),
    });
    if (!res.ok) throw new Error(`Google Calendar create event failed: ${await res.text()}`);
    return res.json();
  }

  async updateEvent(accessToken: string, eventId: string, event: Partial<GoogleCalendarEventInput>) {
    const res = await fetch(`${API_BASE}/calendars/primary/events/${eventId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: event.title,
        description: event.description,
        location: event.location,
        ...(event.startTime && event.timezone ? { start: { dateTime: event.startTime, timeZone: event.timezone } } : {}),
        ...(event.endTime && event.timezone ? { end: { dateTime: event.endTime, timeZone: event.timezone } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Google Calendar update event failed: ${await res.text()}`);
    return res.json();
  }

  async deleteEvent(accessToken: string, eventId: string) {
    const res = await fetch(`${API_BASE}/calendars/primary/events/${eventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok && res.status !== 410) throw new Error(`Google Calendar delete event failed: ${await res.text()}`);
  }
}
