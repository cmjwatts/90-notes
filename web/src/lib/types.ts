export type ItemType = 'issue' | 'todo' | 'headline';
export type ItemStatus =
  | 'pending_review'
  | 'auto_created'
  | 'auto_appended'
  | 'approved'
  | 'skipped'
  | 'failed';

export type AgendaSection =
  | 'segue'
  | 'scorecard'
  | 'rock_review'
  | 'headlines'
  | 'todo_review'
  | 'ids'
  | 'conclude';

export interface DraftItem {
  type: ItemType;
  title: string;
  owner: string;
  team: string;
  notesHtml: string;
  explicit: boolean;
  matchedItemId: string | null;
  matchConfidence: number;
  capturedAtSeconds: number;
}

export interface MeetingItem {
  id: string;
  meeting_id: string;
  type: ItemType;
  status: ItemStatus;
  draft: DraftItem;
  matched_item_id: string | null;
  match_confidence: number | null;
  captured_at_seconds: number;
  category: string | null;
  ninety_id: string | null;
  ninety_url: string | null;
  created_at: string;
}

export interface TranscriptChunk {
  id: string;
  meeting_id: string;
  chunk_id: string;
  lines: Array<{ speaker: string; startSeconds: number; text: string }>;
  received_at: string;
}

export interface IDSInsight {
  id: string;
  meeting_id: string;
  ids_phase: 'identify' | 'discuss' | 'solve' | null;
  minutes_on_issue: number | null;
  root_cause_concern: boolean | null;
  category: string | null;
  should_warn: boolean | null;
  warning_copy: string | null;
  coaching_suggestions: string[] | null;
  current_issue_title: string | null;
  created_at: string;
}

export type NudgeKind = 'tangent_reporting' | 'tangent_ids_drift';
export type NudgeStatus = 'suggested' | 'dropped_down' | 'dismissed';

export interface MeetingNudge {
  id: string;
  meeting_id: string;
  kind: NudgeKind;
  section: AgendaSection | null;
  message: string;
  suggested_issue_title: string | null;
  suggested_issue_notes: string | null;
  status: NudgeStatus;
  created_at: string;
  resolved_at: string | null;
}

export const SECTION_LABELS: Record<AgendaSection, string> = {
  segue: 'Segue',
  scorecard: 'Scorecard',
  rock_review: 'Rock Review',
  headlines: 'Headlines',
  todo_review: 'To-Do Review',
  ids: 'IDS',
  conclude: 'Conclude',
};
