import { anthropic, COLD_LOOP_MODEL } from '../integrations/anthropic.js';
import { buildCachedSystemPrompt } from './playbookPrompt.js';
import type { SessionState } from '../orchestrator/sessionState.js';
import type { AgendaSection } from '../types.js';

/**
 * Cold loop — runs every ~90s. Two jobs:
 *
 *  1. IDS meta-analysis (only during the `ids` section): phase, drift, root-cause
 *     concerns, category, coaching. Also infers which Issue the team is on.
 *  2. Tangent detection (all working sections): the canonical L10 failure mode.
 *     - Reporting sections (scorecard/rock_review/headlines/todo_review) are
 *       report-only; sustained discussion there IS a tangent by definition.
 *     - During IDS, a tangent is drift OFF the chosen Issue onto a new topic.
 *     Either way we hand back a draft Issue so the leader can "drop it down" to
 *     the Issues List in one tap instead of interrupting the room themselves.
 */

// Sections where sustained discussion is a tangent (report-only per EOS).
const REPORTING_SECTIONS: AgendaSection[] = ['scorecard', 'rock_review', 'headlines', 'todo_review'];

export interface ColdLoopInsight {
  idsPhase: 'identify' | 'discuss' | 'solve';
  minutesOnIssue: number;
  rootCauseConcern: boolean;
  category: 'people' | 'process' | 'system' | 'customer' | 'strategy' | null;
  shouldWarn: boolean;
  warningCopy: string | null;
  coachingSuggestions: string[];
}

export interface ColdLoopTangent {
  kind: 'tangent_reporting' | 'tangent_ids_drift';
  message: string;
  suggestedIssueTitle: string | null;
  suggestedIssueNotes: string | null;
}

export interface ColdLoopOutput {
  insight: ColdLoopInsight | null;
  tangent: ColdLoopTangent | null;
  currentIssueId: string | null;
  currentIssueTitle: string | null;
}

const EMPTY: ColdLoopOutput = { insight: null, tangent: null, currentIssueId: null, currentIssueTitle: null };

export async function runColdLoop(opts: {
  session: SessionState;
  playbookText: string;
}): Promise<ColdLoopOutput> {
  const section = opts.session.currentSection;

  // Segue is casual by design; conclude is the rating. Nothing to watch.
  if (section === 'segue' || section === 'conclude') return EMPTY;

  const system = buildCachedSystemPrompt({
    playbookText: opts.playbookText,
    existingItems: opts.session.existingItems,
  });

  const transcript = opts.session.transcriptBuffer
    .map((l) => `[${fmt(l.startSeconds)}] ${l.speaker}: ${l.text}`)
    .join('\n');

  if (!transcript.trim()) return EMPTY;

  if (section === 'ids') return runIdsPass(system, transcript, opts.session);
  if (REPORTING_SECTIONS.includes(section)) return runReportingPass(system, transcript, section);
  return EMPTY;
}

// ── IDS pass: insight + drift + current-issue inference ─────────────────────────
async function runIdsPass(system: string, transcript: string, session: SessionState): Promise<ColdLoopOutput> {
  const userTurn = `<task>
Analyze the IDS discussion in the recent transcript. Report where the team is, whether they're stuck, which Issue they're solving, and whether they've drifted onto a tangent.

Current issue id (may be stale): ${session.currentIssueId ?? '(unspecified)'}
Minutes on current issue (approx): ${session.minutesOnCurrentIssue ?? 'unknown'}
</task>

<transcript>
${transcript}
</transcript>

<format>
Return ONLY a JSON object:
{
  "ids_phase": "identify" | "discuss" | "solve",
  "minutes_on_issue": number,
  "root_cause_concern": boolean,
  "category": "people" | "process" | "system" | "customer" | "strategy" | null,
  "should_warn": boolean,
  "warning_copy": string | null,
  "coaching_suggestions": [string, ...],
  "current_issue_id": string | null,   // best-match id from the [issue|ID] entries in <existing_items>, or null if it's a new/unlisted issue
  "current_issue_title": string | null, // short label for what they're solving right now
  "drift": { "is_drift": boolean, "issue_title": string | null, "issue_notes": string | null }
}

should_warn=true if the team has been in Discuss >10 min with no Solve proposed, OR root_cause_concern=true and no likely root cause has been named.
warning_copy: 1 sentence, plain language.
drift.is_drift=true ONLY if the team has clearly moved off the current issue onto a DIFFERENT topic that deserves its own Issue (a genuine tangent), sustained for more than a passing remark. When true, issue_title/issue_notes describe that new tangent topic so it can be dropped onto the Issues List.
</format>`;

  const text = await callModel(system, userTurn, 640);
  const j = parseJson(text);
  if (!j) return EMPTY;

  const insight: ColdLoopInsight = {
    idsPhase: j.ids_phase,
    minutesOnIssue: j.minutes_on_issue ?? 0,
    rootCauseConcern: Boolean(j.root_cause_concern),
    category: j.category ?? null,
    shouldWarn: Boolean(j.should_warn),
    warningCopy: j.warning_copy ?? null,
    coachingSuggestions: Array.isArray(j.coaching_suggestions) ? j.coaching_suggestions : [],
  };

  const currentIssueId = typeof j.current_issue_id === 'string' ? j.current_issue_id : null;
  const currentIssueTitle = typeof j.current_issue_title === 'string' ? j.current_issue_title : null;

  let tangent: ColdLoopTangent | null = null;
  if (j.drift?.is_drift && j.drift.issue_title) {
    const onto = j.drift.issue_title as string;
    const from = currentIssueTitle ?? 'the current issue';
    tangent = {
      kind: 'tangent_ids_drift',
      message: `Tangent alert 🙂 — with all due love and respect, the team's drifted from "${from}" onto ${onto}. Drop it on the Issues List for later?`,
      suggestedIssueTitle: onto,
      suggestedIssueNotes: (j.drift.issue_notes as string) ?? '',
    };
  }

  return { insight, tangent, currentIssueId, currentIssueTitle };
}

// ── Reporting pass: discussion during a report-only section = tangent ───────────
async function runReportingPass(system: string, transcript: string, section: AgendaSection): Promise<ColdLoopOutput> {
  const label = section.replace('_', ' ');
  const userTurn = `<task>
The meeting is in the "${label}" section. This section is REPORT-ONLY: quick status updates, on/off-track calls, good/bad news — NOT problem-solving. Any sustained discussion, debate, or attempt to solve something here is a tangent that should be "dropped down" to the Issues List and handled during IDS instead.

Decide whether the recent transcript shows the team sliding into discussion/problem-solving rather than reporting. Be conservative: a single clarifying question or a one-line reaction is NOT a tangent. Only flag genuine, sustained solving/debate.
</task>

<transcript>
${transcript}
</transcript>

<format>
Return ONLY a JSON object:
{
  "is_tangent": boolean,
  "issue_title": string | null,   // if a tangent, the Issue to drop onto the list
  "issue_notes": string | null    // 1-2 sentences of context, paraphrased
}
</format>`;

  const text = await callModel(system, userTurn, 320);
  const j = parseJson(text);
  if (!j || !j.is_tangent || !j.issue_title) return EMPTY;

  const title = j.issue_title as string;
  const tangent: ColdLoopTangent = {
    kind: 'tangent_reporting',
    message: `Tangent alert 🙂 — this feels like an IDS discussion during ${label}. Want me to drop "${title}" on the Issues List so you can keep moving?`,
    suggestedIssueTitle: title,
    suggestedIssueNotes: (j.issue_notes as string) ?? '',
  };
  return { insight: null, tangent, currentIssueId: null, currentIssueTitle: null };
}

async function callModel(system: string, userTurn: string, maxTokens: number): Promise<string> {
  const resp = await anthropic.messages.create({
    model: COLD_LOOP_MODEL,
    max_tokens: maxTokens,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userTurn }],
  });
  return resp.content.find((b) => b.type === 'text')?.text ?? '';
}

function parseJson(text: string): any | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}
