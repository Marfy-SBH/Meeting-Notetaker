"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Pause, Play, Square, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecordingStatus, type LiveStatus } from "@/components/live/recording-status";
import { EndMeetingDialog } from "@/components/live/end-meeting-dialog";
import { formatTimer } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { startMeeting, startExistingMeeting, getRecordingUploadTarget, finalizeMeeting } from "@/lib/actions/meetings";

type Phase = "setup" | "permission-error" | "start-error" | "live" | "ending" | "upload-error";

export function LiveMeeting({ meetingId, initialTitle }: { meetingId?: string; initialTitle?: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("setup");
  const [title, setTitle] = useState(initialTitle ?? "");
  const [liveStatus, setLiveStatus] = useState<LiveStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const meetingIdRef = useRef<string | null>(null);
  const workspaceIdRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const pausedAccumRef = useRef<number>(0);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      // "uploading" also covers the upload-error/retry screen — liveStatus is
      // never reset after a failed upload, and the unsaved audio still only
      // lives in this tab's memory until the upload actually succeeds.
      if (liveStatus === "recording" || liveStatus === "paused" || liveStatus === "uploading") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [liveStatus]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function tick() {
    setElapsed(Math.floor((Date.now() - startedAtRef.current - pausedAccumRef.current) / 1000));
  }

  async function handleStart() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch {
      setPhase("permission-error");
      return;
    }

    try {
      // Starting an already-scheduled meeting always begins recording right
      // now, regardless of its originally scheduled time — the scheduled
      // slot is a reservation, not a guarantee of when it actually happens.
      const { meetingId: startedMeetingId, workspaceId } = meetingId
        ? await startExistingMeeting(meetingId)
        : await startMeeting(title);
      meetingIdRef.current = startedMeetingId;
      workspaceIdRef.current = workspaceId;

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;
      recorder.start();

      startedAtRef.current = Date.now();
      pausedAccumRef.current = 0;
      timerRef.current = setInterval(tick, 500);

      setPhase("live");
      setLiveStatus("recording");
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      setStartError(err instanceof Error ? err.message : "Could not start this meeting.");
      setPhase("start-error");
    }
  }

  function handlePause() {
    recorderRef.current?.pause();
    if (timerRef.current) clearInterval(timerRef.current);
    setLiveStatus("paused");
  }

  function handleResume() {
    recorderRef.current?.resume();
    timerRef.current = setInterval(tick, 500);
    setLiveStatus("recording");
  }

  async function handleConfirmEnd() {
    setEnding(true);
    const recorder = recorderRef.current;
    const meetingId = meetingIdRef.current;
    if (!recorder || !meetingId) return;

    if (timerRef.current) clearInterval(timerRef.current);
    const finalDurationSeconds = elapsed;

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.stop();
    await stopped;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    setLiveStatus("uploading");

    try {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const { path } = await getRecordingUploadTarget(meetingId);

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("recordings")
        .upload(path, blob, { contentType: blob.type, upsert: true });
      if (uploadError) throw uploadError;

      await finalizeMeeting(meetingId, finalDurationSeconds);
      router.push(`/meetings/${meetingId}`);
    } catch (err) {
      console.error("Failed to upload recording:", err);
      setPhase("upload-error");
      setEndDialogOpen(false);
    } finally {
      setEnding(false);
    }
  }

  if (phase === "permission-error") {
    return (
      <ErrorScreen
        title="Microphone access is required to record this meeting."
        action={{ label: "Allow Microphone", onClick: () => setPhase("setup") }}
      />
    );
  }

  if (phase === "start-error") {
    return (
      <ErrorScreen
        title={startError ?? "Could not start this meeting."}
        action={{ label: "Back", onClick: () => setPhase("setup") }}
      />
    );
  }

  if (phase === "upload-error") {
    return (
      <ErrorScreen
        title="Your recording could not be uploaded."
        description="Your audio is still in this browser tab. Retry the upload, or leave this page open and try again shortly."
        action={{ label: "Retry Upload", onClick: () => handleConfirmEnd() }}
      />
    );
  }

  if (phase === "setup") {
    return (
      <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mic className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Start a New Meeting</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record your meeting and let AI organize the notes after it&apos;s finished. There&apos;s no live
            transcript — AI processes everything after you end the meeting.
          </p>
        </div>
        {meetingId ? (
          <p className="text-base font-medium text-foreground">{title || "Untitled Meeting"}</p>
        ) : (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Meeting title (optional)"
            className="text-center"
          />
        )}
        <Button size="lg" onClick={handleStart} className="w-full">
          <Mic className="h-4 w-4" /> Start Meeting
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col items-center gap-2 border-b border-border py-8 sm:py-10">
        <h1 className="text-lg font-semibold text-foreground">{title || "Untitled Meeting"}</h1>
        <RecordingStatus status={liveStatus} />
        <span className="font-mono text-4xl font-semibold tabular-nums text-foreground">
          {formatTimer(elapsed)}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center py-10">
        <div className="flex h-32 w-32 items-center justify-center rounded-full bg-primary/5">
          <div
            className={`flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary ${
              liveStatus === "recording" ? "animate-pulse-rec" : ""
            }`}
          >
            <Mic className="h-8 w-8" />
          </div>
        </div>
      </div>

      <div className="sticky bottom-16 flex items-center justify-center gap-3 border-t border-border bg-background py-4 lg:bottom-0">
        {liveStatus === "recording" ? (
          <Button size="lg" variant="secondary" onClick={handlePause}>
            <Pause className="h-4 w-4" /> Pause
          </Button>
        ) : liveStatus === "paused" ? (
          <Button size="lg" variant="secondary" onClick={handleResume}>
            <Play className="h-4 w-4" /> Resume
          </Button>
        ) : null}

        <Button
          size="lg"
          variant="danger"
          disabled={liveStatus === "uploading"}
          onClick={() => setEndDialogOpen(true)}
        >
          <Square className="h-4 w-4" /> End Meeting
        </Button>
      </div>

      <EndMeetingDialog
        open={endDialogOpen}
        onOpenChange={setEndDialogOpen}
        onConfirm={handleConfirmEnd}
        pending={ending}
      />
    </div>
  );
}

function ErrorScreen({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action: { label: string; onClick: () => void };
}) {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <p className="text-base font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <Button onClick={action.onClick}>{action.label}</Button>
    </div>
  );
}
