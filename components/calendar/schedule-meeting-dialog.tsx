"use client";

import { useState, useTransition } from "react";
import { CalendarPlus } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { TimePicker } from "@/components/ui/time-picker";
import { scheduleMeeting } from "@/lib/actions/schedule";
import type { Meeting, Participant } from "@/lib/types";

const REMINDER_OPTIONS = [
  { value: "5", label: "5 minutes before" },
  { value: "10", label: "10 minutes before" },
  { value: "15", label: "15 minutes before" },
  { value: "30", label: "30 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
];

// DB `time` columns come back as "HH:mm:ss" — the time picker wants "HH:mm".
const toHHMM = (t: string | null | undefined) => (t ? t.slice(0, 5) : undefined);

export function ScheduleMeetingDialog({
  trigger,
  meeting,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  trigger?: React.ReactNode;
  meeting?: Meeting & { participants?: Participant[] };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const setOpen = isControlled ? onOpenChangeProp! : setInternalOpen;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await scheduleMeeting(formData);
      if (result?.error) setError(result.error);
      else setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {(trigger || !isControlled) && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="secondary">
              <CalendarPlus className="h-4 w-4" /> Schedule Meeting
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{meeting ? "Edit Meeting" : "Schedule a Meeting"}</DialogTitle>
          <DialogDescription>It will appear on your calendar and sync to Google Calendar if connected.</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
          {meeting && <input type="hidden" name="meetingId" value={meeting.id} />}
          <Field label="Meeting title">
            <Input name="title" placeholder="Product Design Review" defaultValue={meeting?.title} required />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date">
              <Input name="date" type="date" defaultValue={meeting?.scheduled_date ?? undefined} required />
            </Field>
            <Field label="Start time">
              <TimePicker name="startTime" defaultValue={toHHMM(meeting?.scheduled_start_time)} required />
            </Field>
            <Field label="End time (optional)">
              <TimePicker name="endTime" defaultValue={toHHMM(meeting?.scheduled_end_time)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Timezone">
              <Input
                name="timezone"
                defaultValue={meeting?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
              />
            </Field>
            <Field label="Reminder">
              <Select name="reminder" defaultValue={String(meeting?.reminder_minutes ?? 15)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Platform">
            <Select name="platform" defaultValue={meeting?.platform ?? "in_app"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in_app">In-app meeting</SelectItem>
                <SelectItem value="zoom">Zoom</SelectItem>
                <SelectItem value="google_meet">Google Meet</SelectItem>
                <SelectItem value="other">Other / custom link</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Meeting link (optional)">
            <Input name="meetingLink" placeholder="https://…" defaultValue={meeting?.meeting_link ?? undefined} />
          </Field>
          <Field label="Participants (comma-separated emails)">
            <Input
              name="participants"
              placeholder="sarah@company.com, john@company.com"
              defaultValue={meeting?.participants
                ?.map((p) => p.email)
                .filter((email): email is string => Boolean(email))
                .join(", ")}
            />
          </Field>
          <Field label="Description">
            <Textarea name="description" placeholder="What's this meeting about?" />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? (meeting ? "Saving…" : "Scheduling…") : meeting ? "Save Changes" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
