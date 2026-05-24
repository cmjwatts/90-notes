/**
 * Ninety public API client — VERIFIED against /v1/swagger-json (Phase 0 complete).
 *
 * Available endpoints (17 paths):
 *   GET   /v1/teams
 *   POST  /v1/issues          POST /v1/issues/query    GET/PATCH/DELETE /v1/issues/{id}
 *   POST  /v1/todos           POST /v1/todos/query     GET/PATCH/DELETE /v1/todos/{id}
 *   POST  /v1/rocks           POST /v1/rocks/query     GET/PATCH/DELETE /v1/rocks/{id}
 *   POST  /v1/milestones                                GET/PATCH /v1/milestones/{id}
 *   POST  /v1/scorecard/kpis/query  POST/DELETE scores+notes
 *
 * NOT in the public API (so 90 notes treats these as "captured locally only"):
 *   - Headlines (no /headlines endpoint exists)
 *   - Per-meeting agenda / IDS session objects
 *   - Comments
 *   - User/owner lookup
 */
import { config } from '../config.js';
import type { ItemType, ExistingItem } from '../types.js';

export interface CreateIssueInput {
  teamId: string;
  title: string;
  description?: string; // HTML allowed (the editor in Ninety renders rich text)
  interval?: 'short-term' | 'long-term';
  priority?: number;
}

export interface CreateTodoInput {
  teamId?: string;
  title: string;
  description?: string;
  dueDate?: string; // ISO date
  userId?: string;
  repeat?: string;
}

export interface NinetyWriteResult {
  id: string;
  url: string;
}

interface RawIssue {
  _id?: string; id?: string;
  title?: string; description?: string;
  teamId?: string;
  archived?: boolean; completed?: boolean; deleted?: boolean;
  createdDate?: string;
}

interface RawTodo {
  _id?: string; id?: string;
  title?: string; description?: string;
  teamId?: string; userId?: string;
  archived?: boolean; completed?: boolean; deleted?: boolean;
  createdDate?: string;
}

class NinetyClient {
  private headers(): Record<string, string> {
    if (!config.NINETY_API_TOKEN) {
      throw new Error('NINETY_API_TOKEN not set — paste it into .env / Render env vars.');
    }
    return {
      Authorization: `Bearer ${config.NINETY_API_TOKEN}`,
      'Content-Type': 'application/json',
    };
  }

  // ── Teams ─────────────────────────────────────────────────────────────────────

  async listTeams(): Promise<Array<{ id: string; name: string }>> {
    const res = await fetch(`${config.NINETY_API_BASE}/teams`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Ninety GET /teams failed: ${res.status} ${await res.text()}`);
    const items = (await res.json()) as Array<{ _id?: string; id?: string; name?: string; deleted?: boolean; archived?: boolean; project?: boolean }>;
    // Filter out deleted, archived, and project (= non-EOS sub-team) workspaces for the picker.
    return items
      .filter((t) => !t.deleted && !t.archived && !t.project)
      .map((t) => ({ id: (t._id ?? t.id)!, name: t.name ?? '(unnamed)' }));
  }

  // ── Existing-items cache (used at meeting start) ──────────────────────────────

  async listOpenIssues(teamId: string): Promise<ExistingItem[]> {
    const res = await fetch(`${config.NINETY_API_BASE}/issues/query`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ teamId, pageSize: 50, sortField: 'createdDate', sortDirection: 'DESC' }),
    });
    if (!res.ok) throw new Error(`Ninety POST /issues/query failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { items?: RawIssue[] };
    return (body.items ?? [])
      .filter((i) => !i.completed && !i.archived && !i.deleted)
      .map((i) => toExistingItem(i, 'issue'));
  }

  async listOpenTodos(teamId: string): Promise<ExistingItem[]> {
    const res = await fetch(`${config.NINETY_API_BASE}/todos/query`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ teamId, pageSize: 50, completed: false, archived: false }),
    });
    if (!res.ok) throw new Error(`Ninety POST /todos/query failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { items?: RawTodo[] };
    return (body.items ?? [])
      .filter((t) => !t.completed && !t.archived && !t.deleted)
      .map((t) => toExistingItem(t, 'todo'));
  }

  /** Headlines aren't in the public API; return [] so the orchestrator skips matching. */
  async listUpcomingHeadlines(_teamId: string): Promise<ExistingItem[]> {
    return [];
  }

  // ── Reads ─────────────────────────────────────────────────────────────────────

  async getIssue(issueId: string): Promise<RawIssue> {
    const res = await fetch(`${config.NINETY_API_BASE}/issues/${issueId}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Ninety GET /issues/${issueId} failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as RawIssue;
  }

  // ── Writes ────────────────────────────────────────────────────────────────────

  async createIssue(input: CreateIssueInput): Promise<NinetyWriteResult> {
    const res = await fetch(`${config.NINETY_API_BASE}/issues`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        title: input.title,
        teamId: input.teamId,
        description: input.description ?? '',
        interval: input.interval ?? 'short-term',
        priority: input.priority,
      }),
    });
    if (!res.ok) throw new Error(`Ninety POST /issues failed: ${res.status} ${await res.text()}`);
    const json: any = await res.json();
    const id = json.id ?? json._id;
    return { id, url: ninetyAppUrl('issues', id) };
  }

  async createTodo(input: CreateTodoInput): Promise<NinetyWriteResult> {
    const res = await fetch(`${config.NINETY_API_BASE}/todos`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        title: input.title,
        teamId: input.teamId,
        description: input.description ?? '',
        dueDate: input.dueDate,
        userId: input.userId,
      }),
    });
    if (!res.ok) throw new Error(`Ninety POST /todos failed: ${res.status} ${await res.text()}`);
    const json: any = await res.json();
    const id = json.id ?? json._id;
    return { id, url: ninetyAppUrl('todos', id) };
  }

  /**
   * Append IDS notes to an existing Issue.
   * The API has no atomic append — we GET, concatenate, then PATCH the full description.
   * Acceptable race for single-user V1; revisit if multi-user.
   */
  async appendIssueNotes(issueId: string, notesHtml: string): Promise<NinetyWriteResult> {
    const current = await this.getIssue(issueId);
    const newDescription = `${current.description ?? ''}\n<hr/>\n${notesHtml}`;
    const res = await fetch(`${config.NINETY_API_BASE}/issues/${issueId}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ description: newDescription }),
    });
    if (!res.ok) throw new Error(`Ninety PATCH /issues/${issueId} failed: ${res.status} ${await res.text()}`);
    const json: any = await res.json();
    const id = json.id ?? json._id ?? issueId;
    return { id, url: ninetyAppUrl('issues', id) };
  }

  async markTodoDone(todoId: string): Promise<NinetyWriteResult> {
    const res = await fetch(`${config.NINETY_API_BASE}/todos/${todoId}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ completed: true }),
    });
    if (!res.ok) throw new Error(`Ninety PATCH /todos/${todoId} failed: ${res.status} ${await res.text()}`);
    const json: any = await res.json();
    const id = json.id ?? json._id ?? todoId;
    return { id, url: ninetyAppUrl('todos', id) };
  }

  // ── Headlines (not in public API — local-only) ────────────────────────────────

  async appendHeadlineDescription(_headlineId: string, _descriptionAppend: string): Promise<NinetyWriteResult> {
    throw new Error('Headlines are not in the Ninety public API; capture locally only.');
  }

  async createHeadline(input: { teamId: string; title: string; description?: string }): Promise<NinetyWriteResult> {
    throw new Error(`Headlines are not in the Ninety public API. Captured locally: "${input.title}"`);
  }

  async convertHeadlineToIssue(_headlineId: string, _teamId: string): Promise<NinetyWriteResult> {
    throw new Error('Headlines are not in the Ninety public API; no conversion endpoint available.');
  }
}

function toExistingItem(raw: RawIssue | RawTodo, type: ItemType): ExistingItem {
  const id = (raw._id ?? raw.id)!;
  return {
    id,
    type,
    title: raw.title ?? '(untitled)',
    team: raw.teamId ?? '',
    ageDescription: humanAge(raw.createdDate),
    ninetyUrl: ninetyAppUrl(type === 'issue' ? 'issues' : type === 'todo' ? 'todos' : 'headlines', id),
  };
}

function ninetyAppUrl(resource: string, id: string): string {
  // The Ninety app links by resource path. Adjust if the real format differs.
  return `https://app.ninety.io/${resource}/${id}`;
}

function humanAge(iso?: string): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'opened today';
  if (days < 7) return `opened ${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  return `opened ${weeks} wk${weeks === 1 ? '' : 's'} ago`;
}

export const ninety = new NinetyClient();
