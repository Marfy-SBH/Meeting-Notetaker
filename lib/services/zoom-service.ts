// Real Zoom OAuth + Cloud Recordings API wrapper. Falls back to a demo
// provider when ZOOM_CLIENT_ID/SECRET aren't configured — never fakes data,
// just marks the connection as "Connected (Demo)" so the UI is honest about it.
const AUTH_BASE = "https://zoom.us/oauth/authorize";
const TOKEN_URL = "https://zoom.us/oauth/token";
const API_BASE = "https://api.zoom.us/v2";

export interface ZoomTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

export class ZoomService {
  isConfigured() {
    return Boolean(process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);
  }

  getAuthUrl(state: string) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.ZOOM_CLIENT_ID ?? "",
      redirect_uri: process.env.ZOOM_REDIRECT_URI ?? "",
      state,
    });
    return `${AUTH_BASE}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<ZoomTokens> {
    const credentials = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString("base64");
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.ZOOM_REDIRECT_URI ?? "",
      }),
    });
    if (!res.ok) throw new Error(`Zoom token exchange failed: ${await res.text()}`);
    const data = await res.json();
    return { ...data, expiry_date: Date.now() + data.expires_in * 1000 };
  }

  // Cloud recordings become available on Zoom's side after the meeting ends,
  // provided the host's plan supports cloud recording — we only ever surface
  // recordings Zoom itself reports as ready, never claim live capture.
  async listRecentRecordings(accessToken: string) {
    const res = await fetch(`${API_BASE}/users/me/recordings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Zoom list recordings failed: ${await res.text()}`);
    const data = await res.json();
    return data.meetings ?? [];
  }
}
