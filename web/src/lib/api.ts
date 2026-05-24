const API_BASE = import.meta.env.VITE_API_BASE ?? '';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore */ }
    throw new Error(`API ${path} ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listTeams() {
    return req<{ teams: Array<{ id: string; name: string }> }>('/api/ninety/teams');
  },
  listPlaybooks() {
    return req<{ playbooks: Array<{ id: string; name: string }> }>('/api/ninety/playbooks');
  },
  startMeeting(body: { meetingUrl: string; teamId: string; playbookId: string; botName: string }) {
    return req<{ meetingId: string; botId: string }>('/api/meetings/start', { method: 'POST', body: JSON.stringify(body) });
  },
  endMeeting(meetingId: string) {
    return req<{ ok: true }>(`/api/meetings/${meetingId}/end`, { method: 'POST' });
  },
  setSection(meetingId: string, section: string) {
    return req<{ ok: true }>(`/api/meetings/${meetingId}/section`, { method: 'POST', body: JSON.stringify({ section }) });
  },
  approveItem(itemId: string, body: unknown) {
    return req<{ ok: true; ninetyId: string; ninetyUrl: string }>(`/api/items/${itemId}/approve`, { method: 'POST', body: JSON.stringify(body) });
  },
  skipItem(itemId: string) {
    return req<{ ok: true }>(`/api/items/${itemId}/skip`, { method: 'POST' });
  },
  undoItem(itemId: string) {
    return req<{ ok: true }>(`/api/items/${itemId}/undo`, { method: 'POST' });
  },
  coachBot(meetingId: string, message: string) {
    return req<{ ok: true }>('/api/coach/coach-bot', { method: 'POST', body: JSON.stringify({ meetingId, message }) });
  },
  idsCoach(meetingId: string, messages: Array<{ role: 'user' | 'assistant'; content: string }>, currentIssueId: string | null) {
    return req<{ reply: string }>('/api/coach/ids', { method: 'POST', body: JSON.stringify({ meetingId, messages, currentIssueId }) });
  },
};
