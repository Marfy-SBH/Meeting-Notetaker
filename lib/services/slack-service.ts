// Real Slack OAuth wrapper. Slack has no public API for huddle audio capture
// or transcript export — we connect the workspace and surface real channel/
// user data, but never claim automatic huddle recording (see spec §54).
const AUTH_BASE = "https://slack.com/oauth/v2/authorize";
const TOKEN_URL = "https://slack.com/api/oauth.v2.access";

const SCOPES = ["channels:read", "users:read", "chat:write"];

export interface SlackTokens {
  access_token: string;
  team: { id: string; name: string };
}

export class SlackService {
  isConfigured() {
    return Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET);
  }

  getAuthUrl(state: string) {
    const params = new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID ?? "",
      redirect_uri: process.env.SLACK_REDIRECT_URI ?? "",
      scope: SCOPES.join(","),
      state,
    });
    return `${AUTH_BASE}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<SlackTokens> {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID ?? "",
        client_secret: process.env.SLACK_CLIENT_SECRET ?? "",
        code,
        redirect_uri: process.env.SLACK_REDIRECT_URI ?? "",
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(`Slack OAuth failed: ${data.error}`);
    return data;
  }
}
