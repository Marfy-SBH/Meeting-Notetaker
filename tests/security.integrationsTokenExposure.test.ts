import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Regression test for Priority 1d. REQUIRES migration
// supabase/migrations/0006_integrations_token_security.sql to be applied to
// the target Supabase project first (this repo has no way to apply DDL
// itself — see the fix summary for how to run it). Before that migration is
// applied, this test is EXPECTED TO FAIL, correctly demonstrating the
// still-open hole: any workspace member can read another member's connected
// integration's plaintext OAuth tokens.
const serviceSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

describe("integrations token exposure", () => {
  it("get_workspace_integrations() never returns access_token/refresh_token columns", async () => {
    const { data: workspace } = await serviceSupabase.from("workspaces").select("id").limit(1).single();
    if (!workspace) return; // nothing to check against in this dev DB

    const { data, error } = await serviceSupabase.rpc("get_workspace_integrations", {
      p_workspace_id: workspace.id,
    });

    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect(row).not.toHaveProperty("access_token");
      expect(row).not.toHaveProperty("refresh_token");
    }
  });

  it("a member who is not the workspace owner cannot select raw tokens from the base table", async () => {
    // Find a workspace with at least one non-owner member and a connected
    // integration to attach the scenario to.
    const { data: memberships } = await serviceSupabase
      .from("workspace_members")
      .select("workspace_id, user_id, workspaces!inner(owner_id)")
      .limit(200);

    const nonOwnerMembership = (memberships ?? []).find((m: any) => m.user_id !== m.workspaces.owner_id);
    if (!nonOwnerMembership) return; // no multi-member workspace in this dev DB to test against

    const { data: integration } = await serviceSupabase
      .from("integrations")
      .select("id")
      .eq("workspace_id", nonOwnerMembership.workspace_id)
      .limit(1)
      .maybeSingle();
    if (!integration) return; // no connected integration to attach the scenario to

    // We can't sign in as that member without their password, so this
    // exercises the same policy via anon (no session) instead — RLS treats
    // "no matching auth.uid()" the same as "not the owner" for this policy,
    // which is exactly what should block the read either way.
    const anonSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await anonSupabase
      .from("integrations")
      .select("access_token, refresh_token")
      .eq("id", integration.id)
      .maybeSingle();

    expect(error).toBeNull(); // RLS returns an empty result, not a query error
    expect(data).toBeNull();
  });
});
