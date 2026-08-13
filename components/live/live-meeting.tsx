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
import {
  startMeeting,
  startExistingMeeting,
  getChunkUploadTarget,
  finalizeMeeting,
} from "@/lib/actions/meetings";
import {
  MAX_RECORDING_DURATION_SECONDS,
  RECORDING_WARNING_LEAD_SECONDS,
  RECORDING_CHUNK_INTERVAL_MS,
  CHUNK_UPLOAD_RETRY_DELAYS_MS,
} from "@/lib/constants";
import { retryWithBackoff } from "@/lib/retry";

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
  const [autoEndWarning, setAutoEndWarning] = useState(false);
  const [stuckChunkCount, setStuckChunkCount] = useState(0);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const meetingIdRef = useRef<string | null>(null);
  const workspaceIdRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const pausedAccumRef = useRef<number>(0);
  const autoEndedRef = useRef(false);
  const durationSecondsRef = useRef(0);

  // Chunked upload state — each ondataavailable slice uploads immediately
  // instead of sitting in memory until the meeting ends.
  const mimeTypeRef = useRef<string>("audio/webm");
  const chunkSeqRef = useRef(0);
  const pendingUploadsRef = useRef<Promise<void>[]>([]);
  const failedChunksRef = useRef<Map<number, Blob>>(new Map());

  async function uploadChunkAttempt(seq: number, blob: Blob) {
    const meetingId = meetingIdRef.current;
    if (!meetingId) throw new Error("No active meeting.");
    const { path } = await getChunkUploadTarget(meetingId, seq);
    const supabase = createClient();
    const { error } = await supabase.storage
      .from("recordings")
      .upload(path, blob, { contentType: mimeTypeRef.current, upsert: true });
    if (error) throw error;
  }

  // Retries in the background without blocking recording. A chunk that's
  // still failing after all retries is kept (with its blob) in
  // failedChunksRef so it can be retried once more right before finalize.
  async function uploadChunkWithRetry(seq: number, blob: Blob) {
    let markedStuck = false;
    try {
      await retryWithBackoff(async () => {
        try {
          await uploadChunkAttempt(seq, blob);
        } catch (err) {
          if (!markedStuck) {
            markedStuck = true;
            failedChunksRef.current.set(seq, blob);
            setStuckChunkCount(failedChunksRef.current.size);
          }
          throw err;
        }
      }, CHUNK_UPLOAD_RETRY_DELAYS_MS);
      if (markedStuck) {
        failedChunksRef.current.delete(seq);
        setStuckChunkCount(failedChunksRef.current.size);
      }
    } catch {
      // Exhausted retries — stays in failedChunksRef, tried once more in
      // finishUpload() right before finalize.
    }
  }

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
    const elapsedSeconds = Math.floor((Date.now() - startedAtRef.current - pausedAccumRef.current) / 1000);
    setElapsed(elapsedSeconds);

    if (elapsedSeconds >= MAX_RECORDING_DURATION_SECONDS - RECORDING_WARNING_LEAD_SECONDS) {
      setAutoEndWarning(true);
    }

    // A member might not be watching the screen when the cap is hit, so this
    // actively ends and finalizes the meeting rather than just disabling a
    // button and waiting for someone to notice.
    if (!autoEndedRef.current && elapsedSeconds >= MAX_RECORDING_DURATION_SECONDS) {
      autoEndedRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      handleConfirmEnd(elapsedSeconds);
    }
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
      mimeTypeRef.current = recorder.mimeType || "audio/webm";
      chunkSeqRef.current = 0;
      pendingUploadsRef.current = [];
      failedChunksRef.current = new Map();
      setStuckChunkCount(0);
      recorder.ondataavailable = (e) => {
        if (e.data.size === 0) return;
        const seq = chunkSeqRef.current++;
        pendingUploadsRef.current.push(uploadChunkWithRetry(seq, e.data));
      };
      recorderRef.current = recorder;
      // timeslice: emit a chunk roughly every RECORDING_CHUNK_INTERVAL_MS
      // instead of only once at the end, so each piece uploads as the
      // meeting happens — a crash mid-meeting only costs the last chunk.
      recorder.start(RECORDING_CHUNK_INTERVAL_MS);

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

  // Shared by both the initial "End Meeting" confirm and the "Retry" button
  // on the upload-error screen — the retry path never touches the (already
  // stopped) MediaRecorder again, it just re-settles chunk uploads and
  // re-attempts finalize/assemble.
  async function finishUpload(finalDurationSeconds: number) {
    setEnding(true);
    setLiveStatus("uploading");

    try {
      // Wait for every chunk upload started so far (including in-flight
      // retries) to settle — the tail chunk from recorder.stop() is included
      // since ondataavailable fires synchronously before onstop resolves.
      await Promise.allSettled(pendingUploadsRef.current);

      // One more attempt at anything still stuck before giving up — cheap,
      // and avoids reporting "recording incomplete" for a blip that would
      // have succeeded on a second try.
      if (failedChunksRef.current.size > 0) {
        const retries = Array.from(failedChunksRef.current.entries()).map(([seq, blob]) =>
          uploadChunkWithRetry(seq, blob)
        );
        await Promise.allSettled(retries);
      }

      const meetingId = meetingIdRef.current;
      if (!meetingId) throw new Error("Missing meeting id.");
      await finalizeMeeting(meetingId, finalDurationSeconds, chunkSeqRef.current, mimeTypeRef.current);
      router.push(`/meetings/${meetingId}`);
    } catch (err) {
      console.error("Failed to finalize recording:", err);
      setFinalizeError(err instanceof Error ? err.message : "Your recording could not be uploaded.");
      setPhase("upload-error");
      setEndDialogOpen(false);
    } finally {
      setEnding(false);
    }
  }

  async function handleConfirmEnd(overrideDurationSeconds?: number) {
    setEnding(true);
    const recorder = recorderRef.current;
    const meetingId = meetingIdRef.current;
    if (!recorder || !meetingId) return;

    if (timerRef.current) clearInterval(timerRef.current);
    // Prefer the value computed in the same tick that triggered an auto-end
    // over the `elapsed` state, which may not have re-rendered yet.
    const finalDurationSeconds = overrideDurationSeconds ?? elapsed;
    durationSecondsRef.current = finalDurationSeconds;

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.stop();
    await stopped;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    await finishUpload(finalDurationSeconds);
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
    // Audio uploads in ~30s chunks throughout the meeting, so most of the
    // recording is already saved by the time this screen can even appear —
    // only the most recent chunk(s) are actually at risk.
    return (
      <ErrorScreen
        title="Part of your recording could not be saved."
        description={
          finalizeError ??
          "Most of your recording already uploaded safely in the background. Retry to save the rest, or leave this page open and try again shortly."
        }
        action={{
          label: ending ? "Retrying…" : "Retry",
          onClick: () => finishUpload(durationSecondsRef.current),
          disabled: ending,
        }}
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
      {autoEndWarning && (
        <div className="flex items-center justify-center gap-2 bg-warning/10 px-4 py-2 text-center text-sm font-medium text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Recording will auto-end in {formatTimer(Math.max(0, MAX_RECORDING_DURATION_SECONDS - elapsed))}
        </div>
      )}
      <div className="flex flex-col items-center gap-2 border-b border-border py-8 sm:py-10">
        <h1 className="text-lg font-semibold text-foreground">{title || "Untitled Meeting"}</h1>
        <RecordingStatus status={liveStatus} />
        <span className="font-mono text-4xl font-semibold tabular-nums text-foreground">
          {formatTimer(elapsed)}
        </span>
        {stuckChunkCount > 0 && (
          <span className="text-xs text-warning">
            {stuckChunkCount} chunk{stuckChunkCount > 1 ? "s" : ""} retrying in background…
          </span>
        )}
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
  action: { label: string; onClick: () => void; disabled?: boolean };
}) {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <p className="text-base font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <Button onClick={action.onClick} disabled={action.disabled}>
        {action.label}
      </Button>
    </div>
  );
}
