import { Router } from 'express';
import { ninetyFor } from '../integrations/ninety.js';

export const ninetyRouter = Router();

/**
 * GET /api/ninety/teams — list the teams this user belongs to in Ninety.
 * Used by the MeetingSetup page to populate the Team dropdown.
 * Uses the caller's own token (x-ninety-token header) so each user sees their own teams.
 */
ninetyRouter.get('/teams', async (req, res) => {
  try {
    const teams = await ninetyFor(req.header('x-ninety-token')).listTeams();
    res.json({ teams });
  } catch (e) {
    console.error('[GET /api/ninety/teams]', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /api/ninety/playbooks — list available playbooks.
 * V1: hardcoded list. Will read from the playbooks DB table once the Playbook Editor exists.
 */
ninetyRouter.get('/playbooks', (_req, res) => {
  res.json({
    playbooks: [
      { id: 'pb-l10-ops', name: 'Operations Team L10' },
      { id: 'pb-l10-leadership', name: 'Leadership L10' },
      { id: 'pb-quarterly', name: 'Quarterly Planning' },
    ],
  });
});
