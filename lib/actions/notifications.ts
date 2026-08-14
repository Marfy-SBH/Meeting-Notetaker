"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { withPlainErrors } from "@/lib/errors";

export const markNotificationRead = withPlainErrors(async function markNotificationRead(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("notifications").update({ read: true }).eq("id", id).select().single();
  if (error || !data) throw new Error("Could not update this notification.");
  revalidatePath("/", "layout");
});

export const markAllNotificationsRead = withPlainErrors(async function markAllNotificationsRead() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return;
  await supabase.from("notifications").update({ read: true }).eq("user_id", user.user.id).eq("read", false);
  revalidatePath("/", "layout");
});
