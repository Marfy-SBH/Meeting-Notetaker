"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndWorkspace } from "@/lib/data/current";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const { user } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "");
  await supabase.from("profiles").update({ name }).eq("id", user.id);
  revalidatePath("/settings");
}

export async function updateWorkspaceName(formData: FormData) {
  const { workspace } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();
  const name = String(formData.get("workspaceName") ?? "");
  await supabase.from("workspaces").update({ name }).eq("id", workspace.id);
  revalidatePath("/settings");
}

export async function updateSettingsSection(
  section: "recording" | "ai" | "notifications" | "aiConfig",
  patch: Record<string, unknown>
) {
  const { user } = await getCurrentUserAndWorkspace();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("settings").eq("id", user.id).single();
  const current = profile?.settings ?? {};
  const updated = { ...current, [section]: { ...(current[section] ?? {}), ...patch } };
  await supabase.from("profiles").update({ settings: updated }).eq("id", user.id);
  revalidatePath("/settings");
  revalidatePath("/integrations");
}
