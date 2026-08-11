"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndWorkspace } from "@/lib/data/current";
import { CalendarService } from "@/lib/services/calendar-service";
import { revalidatePath } from "next/cache";

export async function scheduleMeeting(formData: FormData) {
  // Called before the try block: redirect() throws a special Next.js signal
  // that must propagate untouched, not get swallowed as a generic error.
  const { user, workspace } = await getCurrentUserAndWorkspace();

  try {
    if (!workspace?.id) {
      console.error("scheduleMeeting: no workspace found for user", user?.id);
      return { error: "Could not find your workspace. Try refreshing the page and signing in again." };
    }

    const supabase = await createClient();

    const title = String(formData.get("title") ?? "Untitled Meeting");
    const date = String(formData.get("date"));
    const startTime = String(formData.get("startTime"));
    const endTime = String(formData.get("endTime"));
    const timezone = String(formData.get("timezone") ?? "UTC");
    const platform = String(formData.get("platform") ?? "in_app");
    const meetingLink = String(formData.get("meetingLink") ?? "") || null;
    const description = String(formData.get("description") ?? "");
    const reminderMinutes = Number(formData.get("reminder") ?? 15);
    const participantEmails = String(formData.get("participants") ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    const { data: meeting, error } = await supabase
      .from("meetings")
      .insert({
        workspace_id: workspace.id,
        created_by: user.id,
        title,
        platform,
        meeting_link: meetingLink,
        status: "scheduled",
        scheduled_date: date,
        scheduled_start_time: startTime,
        scheduled_end_time: endTime,
        timezone,
        reminder_minutes: reminderMinutes,
      })
      .select()
      .single();

    if (error || !meeting) {
      console.error("scheduleMeeting: insert failed", error);
      return { error: error?.message ?? "Could not schedule meeting" };
    }

    if (participantEmails.length > 0) {
      const { error: participantsError } = await supabase.from("participants").insert(
        participantEmails.map((email) => ({ meeting_id: meeting.id, name: email.split("@")[0], email }))
      );
      if (participantsError) console.error("scheduleMeeting: participants insert failed", participantsError);
    }

    try {
      const calendarService = new CalendarService(supabase);
      await calendarService.syncMeetingToGoogle(workspace.id, meeting.id, {
        title,
        description,
        startTime: new Date(`${date}T${startTime}`).toISOString(),
        endTime: new Date(`${date}T${endTime}`).toISOString(),
        timezone,
        location: meetingLink ?? undefined,
        attendees: participantEmails.map((email) => ({ email })),
      });
    } catch (err) {
      console.error("Google Calendar sync skipped/failed", err);
    }

    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    revalidatePath("/meetings");
    return { success: true, meetingId: meeting.id };
  } catch (err) {
    console.error("scheduleMeeting: unexpected error", err);
    return { error: err instanceof Error ? err.message : "Something went wrong while scheduling the meeting." };
  }
}

export async function deleteScheduledMeeting(meetingId: string) {
  const supabase = await createClient();
  await supabase.from("meetings").update({ status: "cancelled" }).eq("id", meetingId);
  revalidatePath("/calendar");
}
