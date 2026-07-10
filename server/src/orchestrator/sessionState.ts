import type { AgendaSection, ExistingItem } from '../types.js';

/**
 * In-memory state for an active meeting. Survives within the server process;
 * mirrored to Supabase for browser-side reads and tab-reload recovery.
 */
export interface SessionState {
  meetingId: string;
  recallBotId: string | null;
  teamId: string;
  playbookId: string;
  // The Ninety token the meeting was started with, captured so the async (webhook-driven)
  // hot/cold-loop writes reach the right workspace. In-memory only — never persisted to the DB.
  ninetyToken: string | null;
  startedAt: number; // ms epoch
  currentSection: AgendaSection;
  existingItems: ExistingItem[];   // cached at meeting start, mutated on new creates
  recentCoachMessages: string[];   // ring buffer, max ~10
  transcriptBuffer: TranscriptLine[]; // last ~20 lines for context window
  lastHotLoopAt: number;
  lastColdLoopAt: number;
  currentIssueId: string | null;   // which issue the team is on (for IDS)
  currentIssueTitle: string | null; // human label for the "Solving: X" chip
  minutesOnCurrentIssue: number;
  // Tangent-nudge calibration (err toward under-nudging — a tangent cop that
  // cries wolf gets muted by week two).
  lastNudgeAt: number;
  nudgeCount: number;
  dismissedNudgeCount: number;
}

export interface TranscriptLine {
  speaker: string;
  startSeconds: number;
  text: string;
}

const sessions = new Map<string, SessionState>();

export function getSession(meetingId: string): SessionState | undefined {
  return sessions.get(meetingId);
}

export function createSession(
  input: Pick<SessionState, 'meetingId' | 'teamId' | 'playbookId' | 'ninetyToken'>,
): SessionState {
  const s: SessionState = {
    ...input,
    recallBotId: null,
    startedAt: Date.now(),
    currentSection: 'segue',
    existingItems: [],
    recentCoachMessages: [],
    transcriptBuffer: [],
    lastHotLoopAt: 0,
    lastColdLoopAt: 0,
    currentIssueId: null,
    currentIssueTitle: null,
    minutesOnCurrentIssue: 0,
    lastNudgeAt: 0,
    nudgeCount: 0,
    dismissedNudgeCount: 0,
  };
  sessions.set(input.meetingId, s);
  return s;
}

/** The leader dismissed a tangent nudge ("we're on topic"). Two dismissals mute
 *  tangent nudges for the rest of the meeting — they're telling us the calibration is off. */
export function recordNudgeDismissed(meetingId: string): void {
  const s = sessions.get(meetingId);
  if (s) s.dismissedNudgeCount += 1;
}

export function endSession(meetingId: string): void {
  sessions.delete(meetingId);
}

export function pushCoachMessage(meetingId: string, msg: string): void {
  const s = sessions.get(meetingId);
  if (!s) return;
  s.recentCoachMessages.push(msg);
  while (s.recentCoachMessages.length > 10) s.recentCoachMessages.shift();
}

export function appendTranscript(meetingId: string, line: TranscriptLine): void {
  const s = sessions.get(meetingId);
  if (!s) return;
  s.transcriptBuffer.push(line);
  while (s.transcriptBuffer.length > 40) s.transcriptBuffer.shift();
}

export function setSection(meetingId: string, section: AgendaSection): void {
  const s = sessions.get(meetingId);
  if (s) s.currentSection = section;
}
