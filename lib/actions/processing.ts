"use server";

import { inngest } from "@/lib/inngest/client";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function triggerMeetingProcessing(meetingId: string) {
  await inngest.send({ name: "meeting/ended", data: { meetingId } });
}

export async function retryProcessing(meetingId: string) {
  const supabase = await createClient();
  await supabase
    .from("meetings")
    .update({ status: "processing", processing_step: "saved", processing_error: null })
    .eq("id", meetingId);

  await triggerMeetingProcessing(meetingId);
  revalidatePath(`/meetings/${meetingId}`);
}
