"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionItemStatus } from "@/lib/types";

export async function updateActionItem(
  id: string,
  meetingId: string,
  fields: Partial<{ task: string; assignee: string | null; due_date: string | null; status: ActionItemStatus }>
) {
  const supabase = await createClient();
  await supabase.from("action_items").update(fields).eq("id", id);
  revalidatePath(`/meetings/${meetingId}`);
}

export async function deleteActionItem(id: string, meetingId: string) {
  const supabase = await createClient();
  await supabase.from("action_items").delete().eq("id", id);
  revalidatePath(`/meetings/${meetingId}`);
}
