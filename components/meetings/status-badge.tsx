import { Badge } from "@/components/ui/badge";
import type { MeetingStatus } from "@/lib/types";

const STATUS_CONFIG: Record<MeetingStatus, { label: string; variant: "default" | "primary" | "success" | "warning" | "danger" | "outline" }> = {
  idle: { label: "Idle", variant: "outline" },
  scheduled: { label: "Scheduled", variant: "primary" },
  recording: { label: "Recording", variant: "danger" },
  paused: { label: "Paused", variant: "warning" },
  uploading: { label: "Uploading", variant: "warning" },
  processing: { label: "Processing", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  cancelled: { label: "Cancelled", variant: "default" },
};

export function StatusBadge({ status }: { status: MeetingStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
