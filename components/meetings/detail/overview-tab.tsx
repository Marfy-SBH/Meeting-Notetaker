import { SummaryTab } from "@/components/meetings/detail/summary-tab";
import { MinutesTab } from "@/components/meetings/detail/minutes-tab";
import type { MeetingWithRelations } from "@/lib/types";

export function OverviewTab({ meeting }: { meeting: MeetingWithRelations }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SummaryTab meeting={meeting} />
      <MinutesTab meeting={meeting} />
    </div>
  );
}
