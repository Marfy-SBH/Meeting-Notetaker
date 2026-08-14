"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { withPlainErrors } from "@/lib/errors";
import type { ActionItemStatus } from "@/lib/types";

export const updateActionItem = withPlainErrors(async function updateActionItem(
  id: string,
  meetingId: string,
  fields: Partial<{ task: string; assignee: string | null; due_date: string | null; status: ActionItemStatus }>
) {
  const supabase = await createClient();
  // .select().single() so an RLS-blocked update (item's meeting isn't in the
  // caller's workspace) throws instead of silently affecting zero rows.
  const { data, error } = await supabase.from("action_items").update(fields).eq("id", id).select().single();
  if (error || !data) throw new Error("Could not update this action item.");
  revalidatePath(`/meetings/${meetingId}`);
});

export const deleteActionItem = withPlainErrors(async function deleteActionItem(id: string, meetingId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("action_items").delete().eq("id", id).select().single();
  if (error || !data) throw new Error("Could not delete this action item.");
  revalidatePath(`/meetings/${meetingId}`);
});
