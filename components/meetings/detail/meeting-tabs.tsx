"use client";

import { LayoutGrid, FileText, ClipboardList, MessageSquareText, CheckSquare, Video } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MeetingMediaProvider, useMeetingMedia } from "@/components/meetings/detail/meeting-media-context";

export function MeetingTabs(props: {
  overview: React.ReactNode;
  summary: React.ReactNode;
  minutes: React.ReactNode;
  transcript: React.ReactNode;
  actionItems: React.ReactNode;
  recording: React.ReactNode;
}) {
  return (
    <MeetingMediaProvider>
      <MeetingTabsInner {...props} />
    </MeetingMediaProvider>
  );
}

function MeetingTabsInner({
  overview,
  summary,
  minutes,
  transcript,
  actionItems,
  recording,
}: {
  overview: React.ReactNode;
  summary: React.ReactNode;
  minutes: React.ReactNode;
  transcript: React.ReactNode;
  actionItems: React.ReactNode;
  recording: React.ReactNode;
}) {
  const { activeTab, setActiveTab } = useMeetingMedia();

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="overview">
          <LayoutGrid className="h-4 w-4" /> Overview
        </TabsTrigger>
        <TabsTrigger value="summary">
          <FileText className="h-4 w-4" /> Summary
        </TabsTrigger>
        <TabsTrigger value="minutes">
          <ClipboardList className="h-4 w-4" /> Minutes
        </TabsTrigger>
        <TabsTrigger value="transcript">
          <MessageSquareText className="h-4 w-4" /> Transcript
        </TabsTrigger>
        <TabsTrigger value="action-items">
          <CheckSquare className="h-4 w-4" /> Action Items
        </TabsTrigger>
        <TabsTrigger value="recording">
          <Video className="h-4 w-4" /> Recording
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview">{overview}</TabsContent>
      <TabsContent value="summary">{summary}</TabsContent>
      <TabsContent value="minutes">{minutes}</TabsContent>
      <TabsContent value="transcript">{transcript}</TabsContent>
      <TabsContent value="action-items">{actionItems}</TabsContent>
      <TabsContent value="recording">{recording}</TabsContent>
    </Tabs>
  );
}
