import type { AppConfig } from './config.js';

export interface DesktopSession {
  meetingId: string;
  uploadToken: string;
  sdkUploadId: string;
}

/** Create a desktop recording session on the backend → returns the Recall upload token. */
export async function createSession(cfg: AppConfig): Promise<DesktopSession> {
  const res = await fetch(`${cfg.backendUrl}/api/desktop/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({ teamId: cfg.defaultTeamId, playbookId: cfg.defaultPlaybookId || 'pb-l10-ops' }),
  });
  if (!res.ok) throw new Error(`createSession failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as DesktopSession;
}

/** Tell the backend the session is over (server-side cleanup). */
export async function endSession(cfg: AppConfig, meetingId: string): Promise<void> {
  await fetch(`${cfg.backendUrl}/api/desktop/sessions/${meetingId}/end`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
  }).catch((e) => console.error('[backend] endSession failed', e));
}

/** List teams from the backend (used by the first-run config form). */
export async function listTeams(cfg: Pick<AppConfig, 'backendUrl'>): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch(`${cfg.backendUrl}/api/ninety/teams`);
  if (!res.ok) throw new Error(`listTeams failed (${res.status})`);
  const json = (await res.json()) as { teams: Array<{ id: string; name: string }> };
  return json.teams;
}
