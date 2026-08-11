"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { retryProcessing } from "@/lib/actions/processing";

const STEP_LABELS: Record<string, string> = {
  saved: "Recording saved",
  transcribing: "Generating transcript",
  summarizing: "Generating summary",
  minutes: "Creating meeting minutes",
  action_items: "Extracting action items",
  decisions: "Detecting decisions",
  moments: "Finding important moments",
};

export function ProcessingBanner({
  meetingId,
  status,
  step,
  error,
}: {
  meetingId: string;
  status: string;
  step: string | null;
  error: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (status !== "processing") return;
    const interval = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(interval);
  }, [status, router]);

  if (status === "failed") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-card border border-danger/30 bg-danger/5 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Your recording is safe, but AI processing could not be completed.
            </p>
            {error && <p className="mt-0.5 text-xs text-muted-foreground">{error}</p>}
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => startTransition(() => retryProcessing(meetingId))}
        >
          {pending ? "Retrying…" : "Retry Processing"}
        </Button>
      </div>
    );
  }

  if (status !== "processing") return null;

  return (
    <div className="flex items-center gap-3 rounded-card border border-warning/30 bg-warning/5 px-4 py-3">
      <Loader2 className="h-4 w-4 animate-spin text-warning" />
      <div>
        <p className="text-sm font-medium text-foreground">Processing your meeting</p>
        <p className="text-xs text-muted-foreground">
          {step ? STEP_LABELS[step] ?? "AI is analyzing your recording…" : "Getting started…"} You can leave this page — we&apos;ll notify you when it&apos;s ready.
        </p>
      </div>
    </div>
  );
}
