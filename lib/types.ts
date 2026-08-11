export type MeetingStatus =
  | "idle"
  | "scheduled"
  | "recording"
  | "paused"
  | "uploading"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type MeetingPlatform = "in_app" | "zoom" | "google_meet" | "other";

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  workspace_id: string;
  title: string;
  platform: MeetingPlatform;
  meeting_link: string | null;
  status: MeetingStatus;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  timezone: string;
  started_at: string | null;
  ended_at: string | null;
  duration: number | null;
  recording_url: string | null;
  created_by: string;
  processing_step: ProcessingStep | null;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
}

export type ProcessingStep =
  | "saved"
  | "transcribing"
  | "summarizing"
  | "minutes"
  | "action_items"
  | "decisions"
  | "moments"
  | "done"
  | "failed";

export interface Participant {
  id: string;
  meeting_id: string;
  name: string;
  email: string | null;
  user_id: string | null;
}

export interface TranscriptSegment {
  id: string;
  meeting_id: string;
  speaker: string;
  start_time: number;
  end_time: number;
  text: string;
}

export interface Bilingual<T> {
  bn: T;
  en: T;
}

export interface Summary {
  id: string;
  meeting_id: string;
  // Stored as a JSON string ({bn, en}) since the column is `text` — parse before use.
  summary: string;
  key_points: Bilingual<string[]>;
  decisions: string[];
}

export interface MinutesContent {
  agenda: string[];
  discussion: string;
  decisions: string[];
  actionItems: string[];
}

export interface MeetingMinutes {
  id: string;
  meeting_id: string;
  content: Bilingual<MinutesContent>;
}

export type ActionItemStatus = "pending" | "in_progress" | "done";

export interface ActionItem {
  id: string;
  meeting_id: string;
  task: string;
  assignee: string | null;
  due_date: string | null;
  status: ActionItemStatus;
}

export interface Decision {
  id: string;
  meeting_id: string;
  text: string;
  timestamp: number | null;
}

export interface ImportantMoment {
  id: string;
  meeting_id: string;
  timestamp: number;
  title: string;
  description: string | null;
}

export interface CalendarEvent {
  id: string;
  meeting_id: string | null;
  provider: "google";
  external_event_id: string;
  calendar_id: string;
  start_time: string;
  end_time: string;
  timezone: string;
  sync_status: "synced" | "pending" | "error";
}

export type IntegrationProvider = "google_calendar" | "zoom" | "slack";

export interface Integration {
  id: string;
  workspace_id: string;
  provider: IntegrationProvider;
  status: "connected" | "disconnected" | "error";
  access_token: string | null;
  refresh_token: string | null;
  created_at: string;
}

export type NotificationType =
  | "meeting_reminder"
  | "summary_ready"
  | "action_items_detected"
  | "calendar_sync"
  | "processing_failed";

export interface Notification {
  id: string;
  user_id: string;
  meeting_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  scheduled_at: string | null;
  created_at: string;
}

export interface MeetingWithRelations extends Meeting {
  participants: Participant[];
  summary?: Summary | null;
  minutes?: MeetingMinutes | null;
  action_items?: ActionItem[];
  decisions?: Decision[];
  important_moments?: ImportantMoment[];
  transcript_segments?: TranscriptSegment[];
}
