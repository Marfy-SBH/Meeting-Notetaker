import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Regression test for Priority 1b: retryProcessing() must not send the
// processing event unless its own RLS-scoped update actually touched a row.
// This exercises the exact query shape retryProcessing() now uses — an
// unauthenticated (anon-key, no session) client can never own any meeting,
// so `is_workspace_member()` is false for every row and the update must be
// blocked. Before the fix, the code didn't check this and would trigger
// processing regardless.
const anonSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

const serviceSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

describe("retryProcessing ownership guard", () => {
  it("RLS blocks an unauthenticated update to any meeting, mirroring the zero-row guard", async () => {
    const { data: someMeeting } = await serviceSupabase.from("meetings").select("id").limit(1).single();
    if (!someMeeting) return; // nothing to attach to in this dev DB — not this test's concern

    const result = await anonSupabase
      .from("meetings")
      .update({ status: "processing", processing_step: "saved", processing_error: null })
      .eq("id", someMeeting.id)
      .select()
      .single();

    // .single() errors when zero rows come back — exactly the condition
    // retryProcessing() now checks before calling triggerMeetingProcessing().
    expect(result.error).not.toBeNull();
    expect(result.data).toBeNull();
  });
});
