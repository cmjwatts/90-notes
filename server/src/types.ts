export type ItemType = 'issue' | 'todo' | 'headline';

export type ItemStatus =
  | 'pending_review'   // appears in the Card Stack focus queue
  | 'auto_created'     // explicit-language → created in Ninety automatically
  | 'auto_appended'    // matched existing item, notes appended
  | 'approved'         // user clicked Approve → pushed to Ninety
  | 'skipped'          // user clicked Skip
  | 'failed';          // Ninety write errored

export type MeetingStatus =
  | 'pending'   // bot dispatched, waiting to join
  | 'live'      // bot in meeting, receiving chunks
  | 'ended'     // bot has left or End meeting was clicked
  | 'failed';

export type AgendaSection =
  | 'segue'
  | 'scorecard'
  | 'rock_review'
  | 'headlines'
  | 'todo_review'
  | 'ids'
  | 'conclude';

export interface ExistingItem {
  id: string;
  type: ItemType;
  title: string;
  team: string;
  ageDescription: string; // "opened 2 wks ago"
  ninetyUrl?: string;
}

export interface DraftItem {
  type: ItemType;
  title: string;
  owner: string;
  team: string;
  notesHtml: string;
  explicit: boolean;
  matchedItemId: string | null;
  matchConfidence: number; // 0–1
  capturedAtSeconds: number; // offset into meeting
}
