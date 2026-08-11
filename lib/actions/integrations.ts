"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndWorkspace } from "@/lib/data/current";
import { revalidatePath } from "next/cache";
import type { IntegrationProvider } from "@/lib/types";

export async function connectDemoIntegration(provider: IntegrationProvider) {
  const { workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();
  await supabase.from("integrations").upsert(
    {
      workspace_id: workspace.id,
      provider,
      status: "connected",
      settings: { demo: true },
    },
    { onConflict: "workspace_id,provider" }
  );
  revalidatePath("/integrations");
}

export async function disconnectIntegration(provider: IntegrationProvider) {
  const { workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();
  await supabase
    .from("integrations")
    .update({ status: "disconnected", access_token: null, refresh_token: null })
    .eq("workspace_id", workspace.id)
    .eq("provider", provider);
  revalidatePath("/integrations");
}

export async function updateIntegrationSettings(provider: IntegrationProvider, settings: Record<string, boolean>) {
  const { workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("integrations")
    .select("settings")
    .eq("workspace_id", workspace.id)
    .eq("provider", provider)
    .single();

  await supabase
    .from("integrations")
    .update({ settings: { ...(existing?.settings ?? {}), ...settings } })
    .eq("workspace_id", workspace.id)
    .eq("provider", provider);
  revalidatePath("/integrations");
}
