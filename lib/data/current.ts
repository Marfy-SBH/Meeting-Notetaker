import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function getCurrentUserAndWorkspace() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userData.user.id).single(),
    supabase
      .from("workspace_members")
      .select("workspace_id, workspaces(*)")
      .eq("user_id", userData.user.id)
      .limit(1)
      .single(),
  ]);

  return {
    user: userData.user,
    profile,
    workspace: membership?.workspaces as any,
  };
}
