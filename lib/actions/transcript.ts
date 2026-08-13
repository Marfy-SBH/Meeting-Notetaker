"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function renameSpeaker(meetingId: string, oldName: string, newName: string) {
  const supabase = await createClient();

  // Zero rows updated is ambiguous here (could mean "no segment has this
  // speaker name", a legitimate outcome) — so ownership is checked directly
  // against the RLS-scoped parent meeting rather than inferred from row count.
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("id")
    .eq("id", meetingId)
    .single();
  if (meetingError || !meeting) throw new Error("Could not find this meeting.");

  await supabase
    .from("transcript_segments")
    .update({ speaker: newName })
    .eq("meeting_id", meetingId)
    .eq("speaker", oldName);
  revalidatePath(`/meetings/${meetingId}`);
}
