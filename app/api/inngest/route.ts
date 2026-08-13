import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { processMeeting, sendMeetingReminders, cleanupExpiredRecordings } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processMeeting, sendMeetingReminders, cleanupExpiredRecordings],
});
