import type { SessionState } from '../orchestrator/sessionState.js';
import type { AgendaSection, ExistingItem } from '../types.js';

/**
 * Builds the cached system prompt for hot/cold-loop Claude calls.
 *
 * Structure (cache-stable across a meeting):
 *   1. Core role + Ninety/EOS rules
 *   2. Playbook description (meeting type)
 *   3. Section-by-section rules table
 *   4. Existing-items context (refreshed only when items are added)
 *   5. Few-shot annotated examples
 *
 * The variable, per-call inputs (transcript buffer, current section, recent
 * coach messages) are passed as the user turn, NOT cached.
 */

const CORE_ROLE = `You are 90 notes — an AI note-taker assisting an EOS (Entrepreneurial Operating System) Level 10 meeting on the Ninety.io platform. You watch the live transcript and decide what should become Issues, To-Dos, Headlines, or notes appended to existing items.

# Hard rules
1. NEVER fabricate. If a name, owner, or detail is not in the transcript, leave it unset rather than guessing.
2. Match before create. If an existing Issue/Headline/To-Do likely covers what's being discussed, APPEND to it instead of creating a duplicate. Use the <existing_items> block as your reference.
3. Honor the current section. The user is in a known agenda section; your listening posture differs per section (see <section_rules>).
4. Mark items as 'explicit' when the speaker uses unambiguous language ("that's an issue", "add a to-do for...", "headline:"). Otherwise mark 'inferred'.
5. Capture IDS issues with structured notes: bold prefixes "Identify:" / "Discuss:" / "Solve:" as separate paragraphs.
6. Prefer one Solve per Issue. A Solve becomes a To-Do owned by the person who proposed it unless reassigned.
`;

const SECTION_RULES_TABLE = `<section_rules>
| Section       | What to capture                                                                                                                                                                                      | Posture        |
|---------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------|
| segue         | Nothing                                                                                                                                                                                              | silent         |
| scorecard     | KPIs called out as off-track → candidate Issue (inferred).                                                                                                                                           | quiet          |
| rock_review   | Off-track Rock + cause → candidate Issue. Dropped → candidate To-Do.                                                                                                                                 | quiet          |
| headlines     | Fetch existing Headlines first. New topic → create. Existing topic with new context → append_to_headline. If questions arise about a Headline → propose convert to Issue.                            | match-first    |
| todo_review   | "Done" → mark_todo_complete. New asks → candidate To-Dos.                                                                                                                                            | normal         |
| ids           | For each Issue: capture Identify restatement, Discuss key points (data, root causes, constraints), single Solve → To-Do for the proposer. Append to existing Issue when matched. Watch for IDS drift.| aggressive     |
| conclude      | Cascading messages → Headlines tagged "cascade". Ratings → ignore (v1).                                                                                                                              | quiet          |
</section_rules>`;

export function formatExistingItems(items: ExistingItem[]): string {
  if (!items.length) return '<existing_items>(none cached yet)</existing_items>';
  const lines = items.map(
    (it) => `- [${it.type}|${it.id}] "${it.title}" — ${it.team} · ${it.ageDescription}`,
  );
  return `<existing_items>\n${lines.join('\n')}\n</existing_items>`;
}

export interface BuildSystemPromptOptions {
  playbookText: string;
  existingItems: ExistingItem[];
}

export function buildCachedSystemPrompt(opts: BuildSystemPromptOptions): string {
  return [
    CORE_ROLE,
    '',
    '# Playbook',
    opts.playbookText,
    '',
    SECTION_RULES_TABLE,
    '',
    formatExistingItems(opts.existingItems),
  ].join('\n');
}

export function buildUserTurn(session: SessionState, latestBuffer: string): string {
  const recentCoach =
    session.recentCoachMessages.length === 0
      ? '(none)'
      : session.recentCoachMessages.map((m, i) => `${i + 1}. ${m}`).join('\n');

  const transcriptWindow = session.transcriptBuffer
    .map((l) => `[${fmtTime(l.startSeconds)}] ${l.speaker}: ${l.text}`)
    .join('\n');

  return `<meeting_state>
current_section: ${session.currentSection}
current_issue_id: ${session.currentIssueId ?? '(none)'}
minutes_on_current_issue: ${session.minutesOnCurrentIssue}
</meeting_state>

<coach_messages_recent>
${recentCoach}
</coach_messages_recent>

<transcript_recent>
${transcriptWindow}
</transcript_recent>

<latest_chunk>
${latestBuffer}
</latest_chunk>

Process the latest chunk in the context of the recent transcript. Use the provided tools to emit any items (create or append). If nothing in the latest chunk warrants action, respond with no tool calls.`;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

export const STARTER_PLAYBOOK_TEXT = `Default Playbook — Operations Team L10

Meeting type: Level 10 — 90 minutes
Agenda: segue (5m) → scorecard (5m) → rock_review (5m) → headlines (5m) → todo_review (5m) → ids (60m) → conclude (5m)

Owners may be referenced by first name; map to the closest match if unambiguous, else leave Unassigned.

Cascading messages at the end go under Headlines with kind="cascade".
`;
