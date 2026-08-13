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

    const meetingId = String(formData.get("meetingId") ?? "") || null;
    const title = String(formData.get("title") ?? "Untitled Meeting");
    const date = String(formData.get("date") ?? "");
    const startTime = String(formData.get("startTime") ?? "");
    const endTime = String(formData.get("endTime") ?? "") || null;
    const timezone = String(formData.get("timezone") ?? "UTC");
    const platform = String(formData.get("platform") ?? "in_app");
    const meetingLink = String(formData.get("meetingLink") ?? "") || null;
    const description = String(formData.get("description") ?? "");
    const reminderMinutes = Number(formData.get("reminder") ?? 15);
    const participantEmails = String(formData.get("participants") ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));

    // The time picker's real value lives in a hidden input, which the browser
    // never constraint-validates — enforce the required fields here instead.
    if (!date || !startTime) {
      return { error: "Please pick a date and start time." };
    }

    const fields = {
      title,
      platform,
      meeting_link: meetingLink,
      scheduled_date: date,
      scheduled_start_time: startTime,
      scheduled_end_time: endTime,
      timezone,
      reminder_minutes: reminderMinutes,
    };

    const { data: meeting, error } = meetingId
      ? await supabase.from("meetings").update(fields).eq("id", meetingId).select().single()
      : await supabase
          .from("meetings")
          .insert({ ...fields, workspace_id: workspace.id, created_by: user.id, status: "scheduled" })
          .select()
          .single();

    if (error || !meeting) {
      console.error("scheduleMeeting: save failed", error);
      return { error: error?.message ?? "Could not schedule meeting" };
    }

    // Editing replaces the participant list wholesale rather than diffing it.
    if (meetingId) await supabase.from("participants").delete().eq("meeting_id", meetingId);

    if (participantEmails.length > 0) {
      const { error: participantsError } = await supabase.from("participants").insert(
        participantEmails.map((email) => ({ meeting_id: meeting.id, name: email.split("@")[0], email }))
      );
      if (participantsError) console.error("scheduleMeeting: participants insert failed", participantsError);
    }

    try {
      const startDateTime = new Date(`${date}T${startTime}`);
      // No end time given — default to a 30-minute block for the calendar sync.
      const endDateTime = endTime ? new Date(`${date}T${endTime}`) : new Date(startDateTime.getTime() + 30 * 60_000);

      const calendarService = new CalendarService(supabase);
      await calendarService.syncMeetingToGoogle(workspace.id, meeting.id, {
        title,
        description,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
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
    revalidatePath(`/meetings/${meeting.id}`);
    return { success: true, meetingId: meeting.id };
  } catch (err) {
    console.error("scheduleMeeting: unexpected error", err);
    return { error: err instanceof Error ? err.message : "Something went wrong while scheduling the meeting." };
  }
}

export async function deleteScheduledMeeting(meetingId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .update({ status: "cancelled" })
    .eq("id", meetingId)
    .select()
    .single();
  if (error || !data) throw new Error("Could not cancel this meeting.");
  revalidatePath("/calendar");
}
