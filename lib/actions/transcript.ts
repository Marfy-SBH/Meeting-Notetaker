"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function renameSpeaker(meetingId: string, oldName: string, newName: string) {
  const supabase = await createClient();
  await supabase
    .from("transcript_segments")
    .update({ speaker: newName })
    .eq("meeting_id", meetingId)
    .eq("speaker", oldName);
  revalidatePath(`/meetings/${meetingId}`);
}
