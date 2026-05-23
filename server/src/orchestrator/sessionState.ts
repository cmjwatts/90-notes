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
  startedAt: number; // ms epoch
  currentSection: AgendaSection;
  existingItems: ExistingItem[];   // cached at meeting start, mutated on new creates
  recentCoachMessages: string[];   // ring buffer, max ~10
  transcriptBuffer: TranscriptLine[]; // last ~20 lines for context window
  lastHotLoopAt: number;
  lastColdLoopAt: number;
  currentIssueId: string | null;   // which issue the team is on (for IDS)
  minutesOnCurrentIssue: number;
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

export function createSession(input: Pick<SessionState, 'meetingId' | 'teamId' | 'playbookId'>): SessionState {
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
    minutesOnCurrentIssue: 0,
  };
  sessions.set(input.meetingId, s);
  return s;
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
