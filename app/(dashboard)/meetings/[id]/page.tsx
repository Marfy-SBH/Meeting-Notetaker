import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MeetingService } from "@/lib/services/meeting-service";
import { MeetingHeader } from "@/components/meetings/detail/meeting-header";
import { ProcessingBanner } from "@/components/meetings/detail/processing-banner";
import { MeetingTabs } from "@/components/meetings/detail/meeting-tabs";
import { OverviewTab } from "@/components/meetings/detail/overview-tab";
import { SummaryTab } from "@/components/meetings/detail/summary-tab";
import { MinutesTab } from "@/components/meetings/detail/minutes-tab";
import { TranscriptTab } from "@/components/meetings/detail/transcript-tab";
import { ActionItemsTab } from "@/components/meetings/detail/action-items-tab";
import { RecordingTab } from "@/components/meetings/detail/recording-tab";

export default async function MeetingDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const meetingService = new MeetingService(supabase);
  const meeting = await meetingService.getWithRelations(params.id);

  if (!meeting) notFound();

  const sortedSegments = [...(meeting.transcript_segments ?? [])].sort((a, b) => a.start_time - b.start_time);

  return (
    <div className="flex flex-col gap-5">
      <MeetingHeader meeting={meeting} />
      <ProcessingBanner
        meetingId={meeting.id}
        status={meeting.status}
        step={meeting.processing_step}
        error={meeting.processing_error}
      />
      <MeetingTabs
        overview={<OverviewTab meeting={meeting} />}
        summary={<SummaryTab meeting={meeting} />}
        minutes={<MinutesTab meeting={meeting} />}
        transcript={
          <TranscriptTab meetingId={meeting.id} segments={sortedSegments} startedAt={meeting.started_at} />
        }
        actionItems={<ActionItemsTab meetingId={meeting.id} items={meeting.action_items ?? []} />}
        recording={
          <RecordingTab
            recordingUrl={meeting.recording_url}
            audioDeletedAt={meeting.audio_deleted_at}
            moments={meeting.important_moments ?? []}
          />
        }
      />
    </div>
  );
}
