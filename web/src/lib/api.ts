const API_BASE = import.meta.env.VITE_API_BASE ?? '';

// The deployed API is protected by a shared secret (APP_API_KEY). We remember it in
// the browser so the user only types it once; a 401 means it's missing/wrong.
const APP_KEY_STORAGE = 'ninety-notes:app-key';

// Each user brings their OWN Ninety personal access token so their items write to their
// own Ninety workspace. It lives only in this browser and rides along as a header; the
// server never stores it. Falls back to the server env token if left blank.
const NINETY_TOKEN_STORAGE = 'ninety-notes:ninety-token';

export function getNinetyToken(): string {
  return localStorage.getItem(NINETY_TOKEN_STORAGE) ?? '';
}

export function setNinetyToken(token: string): void {
  const trimmed = token.trim();
  if (trimmed) localStorage.setItem(NINETY_TOKEN_STORAGE, trimmed);
  else localStorage.removeItem(NINETY_TOKEN_STORAGE);
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const doFetch = () => {
    const key = localStorage.getItem(APP_KEY_STORAGE);
    const ninetyToken = localStorage.getItem(NINETY_TOKEN_STORAGE);
    return fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        ...(ninetyToken ? { 'x-ninety-token': ninetyToken } : {}),
        ...(init?.headers ?? {}),
      },
    });
  };

  let res = await doFetch();

  // On 401, prompt for the app password, store it, and retry once.
  if (res.status === 401) {
    const entered = window.prompt('This app is protected. Enter the app password (APP_API_KEY):');
    if (!entered) {
      throw new Error(`API ${path} 401: unauthorized (no app password entered)`);
    }
    localStorage.setItem(APP_KEY_STORAGE, entered);
    res = await doFetch();
    if (res.status === 401) {
      localStorage.removeItem(APP_KEY_STORAGE);
      throw new Error(`API ${path} 401: app password rejected`);
    }
  }

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
  resolveNudge(nudgeId: string, action: 'dropped_down' | 'dismissed') {
    return req<{ ok: true }>(`/api/nudges/${nudgeId}/resolve`, { method: 'POST', body: JSON.stringify({ action }) });
  },
};
