import { cn } from "@/lib/utils";

export type LiveStatus = "idle" | "recording" | "paused" | "uploading" | "processing" | "failed";

const CONFIG: Record<LiveStatus, { label: string; dotClass: string; textClass: string }> = {
  idle: { label: "Ready", dotClass: "bg-muted-foreground", textClass: "text-muted-foreground" },
  recording: { label: "Recording", dotClass: "bg-recording animate-pulse-rec", textClass: "text-danger" },
  paused: { label: "Recording Paused", dotClass: "bg-warning", textClass: "text-warning" },
  uploading: { label: "Saving Recording", dotClass: "bg-warning", textClass: "text-warning" },
  processing: { label: "Processing", dotClass: "bg-warning", textClass: "text-warning" },
  failed: { label: "Failed", dotClass: "bg-danger", textClass: "text-danger" },
};

export function RecordingStatus({ status, className }: { status: LiveStatus; className?: string }) {
  const config = CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm font-medium", config.textClass, className)}>
      <span className={cn("h-2.5 w-2.5 rounded-full", config.dotClass)} />
      {config.label}
    </span>
  );
}
