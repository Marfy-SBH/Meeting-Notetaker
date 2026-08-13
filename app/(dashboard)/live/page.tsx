import { createClient } from "@/lib/supabase/server";
import { LiveMeeting } from "@/components/live/live-meeting";

export default async function LivePage({ searchParams }: { searchParams: { meetingId?: string } }) {
  let existingMeeting: { id: string; title: string } | undefined;

  if (searchParams.meetingId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("meetings")
      .select("id, title")
      .eq("id", searchParams.meetingId)
      .eq("status", "scheduled")
      .single();
    if (data) existingMeeting = data;
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      <LiveMeeting meetingId={existingMeeting?.id} initialTitle={existingMeeting?.title} />
    </div>
  );
}
