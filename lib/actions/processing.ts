"use server";

import { inngest } from "@/lib/inngest/client";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { withPlainErrors } from "@/lib/errors";

// The Inngest job this triggers runs under the service-role client (it has
// to, to work as a background job with no user session) and does not itself
// re-derive ownership of `meetingId` — so every caller of this function is
// the actual authorization boundary and MUST have already verified, via an
// RLS-respecting read/write, that the current user owns this meeting.
export const triggerMeetingProcessing = withPlainErrors(async function triggerMeetingProcessing(meetingId: string) {
  await inngest.send({ name: "meeting/ended", data: { meetingId } });
});

export const retryProcessing = withPlainErrors(async function retryProcessing(meetingId: string) {
  const supabase = await createClient();
  // .select().single() so an RLS-blocked update (meeting isn't in the
  // caller's workspace) throws here instead of silently affecting zero rows
  // and letting execution fall through to triggering processing anyway.
  const { data, error } = await supabase
    .from("meetings")
    .update({ status: "processing", processing_step: "saved", processing_error: null })
    .eq("id", meetingId)
    .select()
    .single();

  if (error || !data) {
    throw new Error("You don't have access to this meeting.");
  }

  await triggerMeetingProcessing(meetingId);
  revalidatePath(`/meetings/${meetingId}`);
});
