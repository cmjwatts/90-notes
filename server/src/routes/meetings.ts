import { Router } from 'express';
import { z } from 'zod';
import { startMeeting, endMeeting } from '../orchestrator/meetingOrchestrator.js';
import { setSection } from '../orchestrator/sessionState.js';

export const meetingsRouter = Router();

const startSchema = z.object({
  meetingUrl: z.string().url(),
  teamId: z.string().min(1),
  playbookId: z.string().min(1),
  botName: z.string().min(1).default('90 notes'),
});

meetingsRouter.post('/start', async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  try {
    // Per-user Ninety token rides in the header; captured on the session for later writes.
    const result = await startMeeting({ ...parsed.data, ninetyToken: req.header('x-ninety-token') ?? null });
    res.json(result);
  } catch (e) {
    console.error('[POST /meetings/start]', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

meetingsRouter.post('/:id/end', async (req, res) => {
  try {
    await endMeeting(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

const sectionSchema = z.object({
  section: z.enum(['segue', 'scorecard', 'rock_review', 'headlines', 'todo_review', 'ids', 'conclude']),
});

meetingsRouter.post('/:id/section', (req, res) => {
  const parsed = sectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  setSection(req.params.id, parsed.data.section);
  res.json({ ok: true });
});
