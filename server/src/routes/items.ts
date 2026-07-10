import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../integrations/supabase.js';
import { ninetyFor } from '../integrations/ninety.js';
import type { DraftItem } from '../types.js';

export const itemsRouter = Router();

const approveSchema = z.object({
  draft: z.object({
    type: z.enum(['issue', 'todo', 'headline']),
    title: z.string(),
    owner: z.string(),
    team: z.string(),
    notesHtml: z.string(),
    explicit: z.boolean(),
    matchedItemId: z.string().nullable(),
    matchConfidence: z.number(),
    capturedAtSeconds: z.number(),
  }),
  mergeMode: z.boolean(),
  category: z.string().nullable().optional(),
  extra: z.record(z.unknown()).optional(),
});

itemsRouter.post('/:id/approve', async (req, res) => {
  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

  const { draft, mergeMode, category, extra = {} } = parsed.data;
  const sb = supabaseAdmin();
  const nc = ninetyFor(req.header('x-ninety-token'));

  try {
    let result;
    if (mergeMode && draft.matchedItemId) {
      if (draft.type === 'issue') result = await nc.appendIssueNotes(draft.matchedItemId, draft.notesHtml);
      else if (draft.type === 'headline') result = await nc.appendHeadlineDescription(draft.matchedItemId, draft.notesHtml);
      else result = await nc.markTodoDone(draft.matchedItemId);
    } else {
      if (draft.type === 'issue') {
        result = await nc.createIssue({
          teamId: draft.team,
          title: draft.title,
          description: draft.notesHtml,
        });
      } else if (draft.type === 'todo') {
        result = await nc.createTodo({
          teamId: draft.team,
          title: draft.title,
          description: draft.notesHtml,
          dueDate: (extra as any).dueOn,
        });
      } else {
        // Headlines not in Ninety public API — captured in Supabase only; mark approved but no Ninety write.
        result = { id: '', url: '' };
      }
    }
    // Suppress unused-var TS warning for category which is no longer forwarded to Ninety.
    void category;

    await sb
      .from('meeting_items')
      .update({
        status: mergeMode ? 'auto_appended' : 'approved',
        ninety_id: result.id,
        ninety_url: result.url,
        draft: draft as DraftItem,
      })
      .eq('id', req.params.id);

    res.json({ ok: true, ninetyId: result.id, ninetyUrl: result.url });
  } catch (e) {
    console.error('[approve]', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

itemsRouter.post('/:id/skip', async (req, res) => {
  await supabaseAdmin().from('meeting_items').update({ status: 'skipped' }).eq('id', req.params.id);
  res.json({ ok: true });
});

itemsRouter.post('/:id/undo', async (req, res) => {
  // For V1: undo just marks status=skipped. True undo (deleting from Ninety) is a Phase 6+ feature.
  await supabaseAdmin().from('meeting_items').update({ status: 'skipped' }).eq('id', req.params.id);
  res.json({ ok: true });
});
