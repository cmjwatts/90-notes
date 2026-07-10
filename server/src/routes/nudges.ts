import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../integrations/supabase.js';
import { ninetyFor } from '../integrations/ninety.js';
import { recordNudgeDismissed } from '../orchestrator/sessionState.js';
import type { DraftItem } from '../types.js';

export const nudgesRouter = Router();

const resolveSchema = z.object({
  action: z.enum(['dropped_down', 'dismissed']),
});

/**
 * Resolve a tangent nudge.
 *  - dropped_down: create the suggested Issue in Ninety (the EOS "drop it down" move —
 *    it lands on the Issues List for later IDS) and record it as a meeting item so it
 *    shows in the Approved list + recap.
 *  - dismissed: the leader waved us off ("we're on topic"); two of these mute nudges
 *    for the rest of the meeting.
 */
nudgesRouter.post('/:id/resolve', async (req, res) => {
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const sb = supabaseAdmin();

  const { data: nudge, error } = await sb
    .from('meeting_nudges')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!nudge) return res.status(404).json({ error: 'nudge not found' });
  if (nudge.status !== 'suggested') return res.json({ ok: true, alreadyResolved: true });

  if (parsed.data.action === 'dismissed') {
    await sb
      .from('meeting_nudges')
      .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
      .eq('id', nudge.id);
    recordNudgeDismissed(nudge.meeting_id);
    return res.json({ ok: true });
  }

  // dropped_down → create the Issue in Ninety and log a meeting item.
  const { data: meeting } = await sb.from('meetings').select('team_id').eq('id', nudge.meeting_id).maybeSingle();
  const teamId = meeting?.team_id ?? '';
  const title = nudge.suggested_issue_title ?? 'Tangent captured during meeting';
  const notesHtml = nudge.suggested_issue_notes ?? '';

  let ninetyId: string | null = null;
  let ninetyUrl: string | null = null;
  let status: 'auto_created' | 'failed' = 'auto_created';
  try {
    const result = await ninetyFor(req.header('x-ninety-token')).createIssue({ teamId, title, description: notesHtml });
    ninetyId = result.id;
    ninetyUrl = result.url;
  } catch (e) {
    console.error('[nudges/resolve] Ninety createIssue failed — logging item as failed', e);
    status = 'failed';
  }

  const draft: DraftItem = {
    type: 'issue',
    title,
    owner: 'Unassigned',
    team: teamId,
    notesHtml,
    explicit: false,
    matchedItemId: null,
    matchConfidence: 0,
    capturedAtSeconds: 0,
  };

  await sb.from('meeting_items').insert({
    meeting_id: nudge.meeting_id,
    type: 'issue',
    status,
    draft,
    matched_item_id: null,
    match_confidence: 0,
    captured_at_seconds: 0,
    ninety_id: ninetyId,
    ninety_url: ninetyUrl,
  });

  await sb
    .from('meeting_nudges')
    .update({ status: 'dropped_down', resolved_at: new Date().toISOString() })
    .eq('id', nudge.id);

  res.json({ ok: true, ninetyId, ninetyUrl });
});
