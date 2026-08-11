import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "meeting-note-taker" });

export interface MeetingEndedEvent {
  name: "meeting/ended";
  data: { meetingId: string };
}
