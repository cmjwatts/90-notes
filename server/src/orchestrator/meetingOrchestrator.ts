import { queueForMeeting, dropMeetingQueue } from './meetingQueue.js';
import {
  getSession,
  createSession,
  endSession,
  appendTranscript,
  type SessionState,
  type TranscriptLine,
} from './sessionState.js';
import { ninety } from '../integrations/ninety.js';
import { supabaseAdmin } from '../integrations/supabase.js';
import { dispatchRecallBot, leaveRecallBot } from '../integrations/recall.js';
import { runHotLoop } from '../llm/hotLoop.js';
import { runColdLoop } from '../llm/coldLoop.js';
import { STARTER_PLAYBOOK_TEXT } from '../llm/playbookPrompt.js';
import type { DraftItem } from '../types.js';

const BUFFER_FLUSH_MS = 10_000;        // hot loop cadence
const COLD_LOOP_INTERVAL_MS = 90_000;  // cold loop cadence

/** Start a meeting: dispatch Recall bot, pre-fetch existing items, create session. */
export async function startMeeting(input: {
  meetingUrl: string;
  teamId: string;
  playbookId: string;
  botName: string;
}): Promise<{ meetingId: string; botId: string }> {
  // Insert meeting row in Supabase
  const sb = supabaseAdmin();
  const { data: row, error } = await sb
    .from('meetings')
    .insert({
      team_id: input.teamId,
      playbook_id: input.playbookId,
      meeting_url: input.meetingUrl,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error) throw new Error(`Supabase insert meeting failed: ${error.message}`);
  const meetingId = row.id as string;

  // Pre-fetch existing items (best-effort — Phase 0 verifies endpoints exist).
  let existing: SessionState['existingItems'] = [];
  try {
    const [issues, todos, headlines] = await Promise.all([
      ninety.listOpenIssues(input.teamId),
      ninety.listOpenTodos(input.teamId),
      ninety.listUpcomingHeadlines(input.teamId),
    ]);
    existing = [...issues, ...todos, ...headlines];
  } catch (e) {
    console.warn('[startMeeting] could not pre-fetch existing items (likely Phase 0 incomplete):', (e as Error).message);
  }

  // Create in-memory session.
  const session = createSession({ meetingId, teamId: input.teamId, playbookId: input.playbookId });
  session.existingItems = existing;

  // Dispatch the bot.
  const bot = await dispatchRecallBot({
    meetingUrl: input.meetingUrl,
    botName: input.botName,
    meetingId,
  });
  session.recallBotId = bot.id;

  await sb.from('meetings').update({ recall_bot_id: bot.id, status: 'live' }).eq('id', meetingId);

  // Kick off the periodic cold loop.
  startColdLoopTimer(meetingId);

  return { meetingId, botId: bot.id };
}

/** Handle one transcript chunk from Recall.ai. Enqueues processing per-meeting. */
export function ingestTranscriptChunk(input: {
  meetingId: string;
  chunkId: string;
  lines: TranscriptLine[];
}): void {
  const session = getSession(input.meetingId);
  if (!session) {
    console.warn(`[ingest] unknown meeting ${input.meetingId} — chunk dropped`);
    return;
  }

  const q = queueForMeeting(input.meetingId);
  q.add(async () => {
    // Idempotency: skip if we've already stored this chunk_id.
    const sb = supabaseAdmin();
    const { data: existing } = await sb
      .from('transcript_chunks')
      .select('id')
      .eq('chunk_id', input.chunkId)
      .maybeSingle();
    if (existing) return;

    // Append to in-memory buffer + persist.
    for (const line of input.lines) {
      appendTranscript(input.meetingId, line);
    }
    await sb.from('transcript_chunks').insert({
      meeting_id: input.meetingId,
      chunk_id: input.chunkId,
      lines: input.lines,
    });

    // Hot-loop flush gate: at most every BUFFER_FLUSH_MS.
    const now = Date.now();
    if (now - session.lastHotLoopAt < BUFFER_FLUSH_MS) return;
    session.lastHotLoopAt = now;

    const buffered = input.lines.map((l) => `${l.speaker}: ${l.text}`).join('\n');
    try {
      const result = await runHotLoop({
        session,
        playbookText: STARTER_PLAYBOOK_TEXT, // TODO: load from playbooks table once editor exists
        latestBuffer: buffered,
      });
      for (const call of result.toolCalls) {
        await handleToolCall(input.meetingId, call, session);
      }
      await sb.from('meeting_cost_events').insert({
        meeting_id: input.meetingId,
        kind: 'hot_loop',
        input_tokens: result.inputTokens,
        cached_tokens: result.cachedTokens,
        output_tokens: result.outputTokens,
      });
    } catch (e) {
      console.error('[hotLoop] error', e);
    }
  });
}

async function handleToolCall(
  meetingId: string,
  call: { name: string; input: any },
  session: SessionState,
): Promise<void> {
  const sb = supabaseAdmin();
  const explicit = Boolean(call.input.explicit);
  const captureSec = Number(call.input.captured_at_seconds ?? 0);

  switch (call.name) {
    case 'create_issue': {
      const draft: DraftItem = {
        type: 'issue',
        title: call.input.title,
        owner: call.input.owner ?? 'Unassigned',
        team: session.teamId,
        notesHtml: idsNotesHtml(call.input),
        explicit,
        matchedItemId: null,
        matchConfidence: 0,
        capturedAtSeconds: captureSec,
      };
      await persistDraft(meetingId, draft, call.input.category ?? null);
      break;
    }
    case 'append_to_issue': {
      const draft: DraftItem = {
        type: 'issue',
        title: '(append)',
        owner: 'Unassigned',
        team: session.teamId,
        notesHtml: idsNotesHtml(call.input),
        explicit,
        matchedItemId: call.input.issue_id,
        matchConfidence: Number(call.input.match_confidence ?? 0),
        capturedAtSeconds: captureSec,
      };
      await persistDraft(meetingId, draft);
      break;
    }
    case 'create_todo': {
      const draft: DraftItem = {
        type: 'todo',
        title: call.input.title,
        owner: call.input.owner ?? 'Unassigned',
        team: session.teamId,
        notesHtml: '',
        explicit,
        matchedItemId: null,
        matchConfidence: 0,
        capturedAtSeconds: captureSec,
      };
      await persistDraft(meetingId, draft, null, { dueOn: call.input.due_on });
      break;
    }
    case 'mark_todo_complete': {
      await sb.from('meeting_items').insert({
        meeting_id: meetingId,
        type: 'todo',
        status: explicit ? 'auto_appended' : 'pending_review',
        draft: { action: 'mark_complete', todo_id: call.input.todo_id },
        matched_item_id: call.input.todo_id,
        captured_at_seconds: captureSec,
      });
      break;
    }
    case 'create_headline': {
      const draft: DraftItem = {
        type: 'headline',
        title: call.input.title,
        owner: 'Unassigned',
        team: session.teamId,
        notesHtml: call.input.description ?? '',
        explicit,
        matchedItemId: null,
        matchConfidence: 0,
        capturedAtSeconds: captureSec,
      };
      await persistDraft(meetingId, draft, null, { kind: call.input.kind });
      break;
    }
    case 'append_to_headline': {
      const draft: DraftItem = {
        type: 'headline',
        title: '(append)',
        owner: 'Unassigned',
        team: session.teamId,
        notesHtml: call.input.description_append,
        explicit,
        matchedItemId: call.input.headline_id,
        matchConfidence: Number(call.input.match_confidence ?? 0),
        capturedAtSeconds: captureSec,
      };
      await persistDraft(meetingId, draft);
      break;
    }
    case 'convert_headline_to_issue': {
      const draft: DraftItem = {
        type: 'issue',
        title: call.input.new_issue_title,
        owner: 'Unassigned',
        team: session.teamId,
        notesHtml: '',
        explicit,
        matchedItemId: call.input.headline_id,
        matchConfidence: 1,
        capturedAtSeconds: captureSec,
      };
      await persistDraft(meetingId, draft, null, { convertFromHeadline: true });
      break;
    }
    default:
      console.warn('[handleToolCall] unknown tool', call.name);
  }
}

function idsNotesHtml(input: any): string {
  const parts: string[] = [];
  if (input.notes_identify) parts.push(`<p><strong>Identify:</strong> ${escape(input.notes_identify)}</p>`);
  if (input.notes_discuss) parts.push(`<p><strong>Discuss:</strong> ${escape(input.notes_discuss)}</p>`);
  if (input.notes_solve) parts.push(`<p><strong>Solve:</strong> ${escape(input.notes_solve)}</p>`);
  return parts.join('\n');
}

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
}

async function persistDraft(
  meetingId: string,
  draft: DraftItem,
  category: string | null = null,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const sb = supabaseAdmin();

  // Decide initial status. Explicit + (no match OR match without category=conversion) → auto-write to Ninety.
  const isAppend = !!draft.matchedItemId;
  const willAuto = draft.explicit;
  let status: 'pending_review' | 'auto_created' | 'auto_appended' | 'failed' = willAuto
    ? isAppend
      ? 'auto_appended'
      : 'auto_created'
    : 'pending_review';

  let ninetyId: string | null = null;
  let ninetyUrl: string | null = null;

  if (willAuto) {
    try {
      const result = await writeDraftToNinety(draft, category, extra);
      ninetyId = result.id;
      ninetyUrl = result.url;
    } catch (e) {
      console.error('[persistDraft] Ninety write failed — falling back to pending_review', e);
      status = 'failed';
    }
  }

  await sb.from('meeting_items').insert({
    meeting_id: meetingId,
    type: draft.type,
    status,
    draft,
    matched_item_id: draft.matchedItemId,
    match_confidence: draft.matchConfidence,
    captured_at_seconds: draft.capturedAtSeconds,
    category,
    ninety_id: ninetyId,
    ninety_url: ninetyUrl,
    extra,
  });
}

async function writeDraftToNinety(
  draft: DraftItem,
  category: string | null,
  extra: Record<string, unknown>,
): Promise<{ id: string; url: string }> {
  if (draft.matchedItemId) {
    // append path
    if (draft.type === 'issue') return ninety.appendIssueNotes(draft.matchedItemId, draft.notesHtml);
    if (draft.type === 'headline') return ninety.appendHeadlineDescription(draft.matchedItemId, draft.notesHtml);
    if (draft.type === 'todo') return ninety.markTodoDone(draft.matchedItemId);
  }
  // create path
  if (draft.type === 'issue') {
    void category;
    return ninety.createIssue({
      teamId: draft.team,
      title: draft.title,
      description: draft.notesHtml,
    });
  }
  if (draft.type === 'todo') {
    return ninety.createTodo({
      teamId: draft.team,
      title: draft.title,
      description: draft.notesHtml,
      dueDate: (extra.dueOn as string) ?? undefined,
    });
  }
  // Headlines: not in Ninety public API. The orchestrator already persists the draft to Supabase
  // as 'failed' or pending_review; the recap surfaces them so you can copy them into Ninety manually.
  return { id: '', url: '' };
}

// ---- Cold loop timer -----------------------------------------------------------------

const coldTimers = new Map<string, NodeJS.Timeout>();

function startColdLoopTimer(meetingId: string): void {
  if (coldTimers.has(meetingId)) return;
  const t = setInterval(async () => {
    const session = getSession(meetingId);
    if (!session) {
      clearInterval(t);
      coldTimers.delete(meetingId);
      return;
    }
    session.lastColdLoopAt = Date.now();
    try {
      const insight = await runColdLoop({ session, playbookText: STARTER_PLAYBOOK_TEXT });
      if (!insight) return;
      await supabaseAdmin().from('ids_insights').insert({
        meeting_id: meetingId,
        ids_phase: insight.idsPhase,
        minutes_on_issue: insight.minutesOnIssue,
        root_cause_concern: insight.rootCauseConcern,
        category: insight.category,
        should_warn: insight.shouldWarn,
        warning_copy: insight.warningCopy,
        coaching_suggestions: insight.coachingSuggestions,
      });
    } catch (e) {
      console.error('[coldLoop] error', e);
    }
  }, COLD_LOOP_INTERVAL_MS);
  coldTimers.set(meetingId, t);
}

export async function endMeeting(meetingId: string): Promise<void> {
  const session = getSession(meetingId);
  if (session?.recallBotId) {
    try { await leaveRecallBot(session.recallBotId); } catch (e) { console.warn('leaveRecallBot failed', e); }
  }
  const sb = supabaseAdmin();
  await sb.from('meetings').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', meetingId);

  const timer = coldTimers.get(meetingId);
  if (timer) clearInterval(timer);
  coldTimers.delete(meetingId);
  dropMeetingQueue(meetingId);
  endSession(meetingId);
}
