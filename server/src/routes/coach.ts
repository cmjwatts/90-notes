import { Router } from 'express';
import { z } from 'zod';
import { coachReply } from '../llm/coachReply.js';
import { getSession, pushCoachMessage } from '../orchestrator/sessionState.js';
import { supabaseAdmin } from '../integrations/supabase.js';

export const coachRouter = Router();

const coachMessageSchema = z.object({
  meetingId: z.string().min(1),
  message: z.string().min(1).max(2000),
});

/** Meeting-room coach chat: appends to ring buffer that the hot loop reads. */
coachRouter.post('/coach-bot', async (req, res) => {
  const parsed = coachMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  pushCoachMessage(parsed.data.meetingId, parsed.data.message);
  await supabaseAdmin().from('coach_messages').insert({
    meeting_id: parsed.data.meetingId,
    role: 'user',
    content: parsed.data.message,
  });
  res.json({ ok: true });
});

const idsCoachSchema = z.object({
  meetingId: z.string().min(1),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })),
  currentIssueId: z.string().nullable(),
});

/** IDS Coach FAB chat — separate from the meeting-room coach (free-form Q&A about IDS). */
coachRouter.post('/ids', async (req, res) => {
  const parsed = idsCoachSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

  const session = getSession(parsed.data.meetingId);
  if (!session) return res.status(404).json({ error: 'meeting not found' });

  const currentIssue = parsed.data.currentIssueId
    ? session.existingItems.find((i) => i.id === parsed.data.currentIssueId)
    : null;

  try {
    const reply = await coachReply({
      currentIssue: currentIssue ? { title: currentIssue.title, id: currentIssue.id } : null,
      relatedIssues: session.existingItems.filter((i) => i.type === 'issue').slice(0, 6),
      messages: parsed.data.messages,
    });
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});
