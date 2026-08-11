import { Video, Users2, Link2 } from "lucide-react";
import type { MeetingPlatform } from "@/lib/types";

const CONFIG: Record<MeetingPlatform, { label: string; icon: typeof Video }> = {
  in_app: { label: "In-App", icon: Users2 },
  zoom: { label: "Zoom", icon: Video },
  google_meet: { label: "Google Meet", icon: Video },
  other: { label: "Other", icon: Link2 },
};

export function PlatformLabel({ platform, className }: { platform: MeetingPlatform; className?: string }) {
  const config = CONFIG[platform] ?? CONFIG.other;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}
