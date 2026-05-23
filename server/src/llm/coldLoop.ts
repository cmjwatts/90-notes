import { anthropic, COLD_LOOP_MODEL } from '../integrations/anthropic.js';
import { buildCachedSystemPrompt } from './playbookPrompt.js';
import type { SessionState } from '../orchestrator/sessionState.js';

/**
 * Cold loop — runs every ~90s during IDS. Looks at the last 5-10 min of
 * transcript focused on the current Issue and surfaces meta-analysis:
 * IDS phase, drift, root-cause concerns, category, and coaching suggestions.
 */

export interface ColdLoopInsight {
  idsPhase: 'identify' | 'discuss' | 'solve';
  minutesOnIssue: number;
  rootCauseConcern: boolean;
  category: 'people' | 'process' | 'system' | 'customer' | 'strategy' | null;
  shouldWarn: boolean;
  warningCopy: string | null;
  coachingSuggestions: string[];
}

export async function runColdLoop(opts: {
  session: SessionState;
  playbookText: string;
}): Promise<ColdLoopInsight | null> {
  if (opts.session.currentSection !== 'ids') return null;

  const system = buildCachedSystemPrompt({
    playbookText: opts.playbookText,
    existingItems: opts.session.existingItems,
  });

  const transcript = opts.session.transcriptBuffer
    .map((l) => `[${fmt(l.startSeconds)}] ${l.speaker}: ${l.text}`)
    .join('\n');

  const userTurn = `<task>
Analyze the IDS discussion in the recent transcript and return a JSON object describing where we are and whether we're stuck.

Current issue id: ${opts.session.currentIssueId ?? '(unspecified)'}
Minutes on current issue (approx): ${opts.session.minutesOnCurrentIssue ?? 'unknown'}
</task>

<transcript>
${transcript}
</transcript>

<format>
Return ONLY a JSON object matching:
{
  "ids_phase": "identify" | "discuss" | "solve",
  "minutes_on_issue": number,
  "root_cause_concern": boolean,
  "category": "people" | "process" | "system" | "customer" | "strategy" | null,
  "should_warn": boolean,
  "warning_copy": string | null,
  "coaching_suggestions": [string, ...]
}

should_warn=true if the team has been in Discuss for >10 minutes without a Solve being proposed, OR if root_cause_concern=true and no one has named a likely root cause.
warning_copy: 1 sentence, plain language, e.g. "you've been on the NPS issue 11 min with no solution proposed. Time to move toward solve."
</format>`;

  const resp = await anthropic.messages.create({
    model: COLD_LOOP_MODEL,
    max_tokens: 512,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userTurn }],
  });

  const text = resp.content.find((b) => b.type === 'text')?.text ?? '';
  return parseInsight(text);
}

function parseInsight(text: string): ColdLoopInsight | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const j = JSON.parse(jsonMatch[0]);
    return {
      idsPhase: j.ids_phase,
      minutesOnIssue: j.minutes_on_issue ?? 0,
      rootCauseConcern: Boolean(j.root_cause_concern),
      category: j.category ?? null,
      shouldWarn: Boolean(j.should_warn),
      warningCopy: j.warning_copy ?? null,
      coachingSuggestions: Array.isArray(j.coaching_suggestions) ? j.coaching_suggestions : [],
    };
  } catch {
    return null;
  }
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}
