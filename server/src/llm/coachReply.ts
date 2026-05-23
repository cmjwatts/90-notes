import { anthropic, COACH_MODEL } from '../integrations/anthropic.js';
import type { ExistingItem } from '../types.js';

/**
 * IDS Coach FAB chat. Stateless conversation — caller passes the full chat
 * history each call. Pre-loaded with the current issue context.
 */
export async function coachReply(opts: {
  currentIssue: { title: string; id: string } | null;
  relatedIssues: ExistingItem[];
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<string> {
  const system = `You are the IDS Coach for 90 notes. Help the meeting leader work through the EOS Identify–Discuss–Solve cycle for the current Issue.

Focus on:
- Surfacing root causes (5 Whys, problem-vs-symptom framing)
- Concrete discussion questions to advance the conversation
- What a good Solve looks like (single owner, single action, measurable)
- Fast experiment ideas when the team is stuck

Reference the team's actual past Issues when relevant — keep advice grounded in their history, not generic EOS theory.

Current issue: ${opts.currentIssue ? `"${opts.currentIssue.title}" (id: ${opts.currentIssue.id})` : '(no issue focused yet)'}

Related past issues for this team:
${opts.relatedIssues.length ? opts.relatedIssues.map((i) => `- [${i.type}|${i.id}] ${i.title}`).join('\n') : '(none)'}

Style: short, direct, conversational. 1-3 sentences per reply unless the user asks for a list. Never preach.`;

  const resp = await anthropic.messages.create({
    model: COACH_MODEL,
    max_tokens: 400,
    system,
    messages: opts.messages,
  });

  const text = resp.content.find((b) => b.type === 'text')?.text ?? '';
  return text.trim();
}
