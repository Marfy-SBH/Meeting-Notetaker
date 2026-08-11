import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationType } from "@/lib/types";

export class NotificationService {
  constructor(private supabase: SupabaseClient) {}

  async create(input: {
    userId: string;
    meetingId?: string | null;
    type: NotificationType;
    title: string;
    message: string;
    scheduledAt?: string | null;
  }) {
    await this.supabase.from("notifications").insert({
      user_id: input.userId,
      meeting_id: input.meetingId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      scheduled_at: input.scheduledAt ?? null,
    });
  }
}
