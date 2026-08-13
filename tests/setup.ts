import { config } from "dotenv";
import path from "path";
import WebSocket from "ws";

config({ path: path.resolve(__dirname, "../.env.local") });

// Node 20 has no global WebSocket; @supabase/supabase-js's realtime client
// constructor requires one to exist even when realtime features aren't used.
if (!("WebSocket" in globalThis)) {
  (globalThis as any).WebSocket = WebSocket;
}
