import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { startDesktopMeeting, endMeeting } from '../orchestrator/meetingOrchestrator.js';

export const desktopRouter = Router();

/**
 * Bearer-token auth for all /api/desktop/* routes.
 * The Mac menubar app sends `Authorization: Bearer <DESKTOP_API_KEY>`.
 */
desktopRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (!config.DESKTOP_API_KEY) {
    return res.status(503).json({ error: 'Desktop mode not enabled on this server (DESKTOP_API_KEY unset).' });
  }
  const header = req.header('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (token !== config.DESKTOP_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

const startSchema = z.object({
  teamId: z.string().min(1),
  playbookId: z.string().min(1),
});

/**
 * POST /api/desktop/sessions
 * Creates a meeting session + a Recall SDK upload. Returns the uploadToken the
 * desktop app passes to RecallAiSdk.startRecording().
 */
desktopRouter.post('/sessions', async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  try {
    const result = await startDesktopMeeting(parsed.data);
    res.json(result); // { meetingId, uploadToken, sdkUploadId }
  } catch (e) {
    console.error('[POST /api/desktop/sessions]', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * POST /api/desktop/sessions/:id/end
 * Ends the session (orchestrator cleanup). The desktop app calls
 * RecallAiSdk.stopRecording() locally; this just tears down server-side state.
 */
desktopRouter.post('/sessions/:id/end', async (req, res) => {
  try {
    await endMeeting(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});
