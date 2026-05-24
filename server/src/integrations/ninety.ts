/**
 * Ninety public API client.
 *
 * STATUS: STUB INTERFACE. Endpoint paths and body shapes are PLACEHOLDERS.
 * Phase 0 of the plan blocks on Christine pasting in the authenticated swagger
 * spec; once we have it, replace every TODO_VERIFY: line with the real URL/shape.
 *
 * The interface is shaped how the orchestrator wants to use it, so the swap is
 * isolated to this file.
 */
import { config } from '../config.js';
import type { ItemType, ExistingItem } from '../types.js';

export interface CreateIssueInput {
  teamId: string;
  title: string;
  ownerId?: string;
  notesHtml?: string;
  category?: 'people' | 'process' | 'system' | 'customer' | 'strategy';
}

export interface CreateTodoInput {
  teamId: string;
  title: string;
  ownerId?: string;
  dueOn?: string; // ISO date
  notesHtml?: string;
}

export interface CreateHeadlineInput {
  teamId: string;
  title: string;
  description?: string;
  kind?: 'customer' | 'employee' | 'cascade';
}

export interface NinetyWriteResult {
  id: string;
  url: string; // deep link into Ninety
}

class NinetyClient {
  private headers(): Record<string, string> {
    if (!config.NINETY_API_TOKEN) {
      throw new Error('NINETY_API_TOKEN not set — Phase 0 verification incomplete.');
    }
    return {
      Authorization: `Bearer ${config.NINETY_API_TOKEN}`,
      'Content-Type': 'application/json',
    };
  }

  // ----- TEAMS (used at meeting start + by the MeetingSetup dropdown) -----------------

  async listTeams(): Promise<Array<{ id: string; name: string }>> {
    // TODO_VERIFY: endpoint path. Common patterns: /teams, /workspaces/{id}/teams, /me/teams
    const res = await fetch(`${config.NINETY_API_BASE}/teams`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Ninety list teams failed: ${res.status} ${await res.text()}`);
    const json: any = await res.json();
    const items: any[] = Array.isArray(json) ? json : (json.items ?? json.data ?? json.teams ?? []);
    return items.map((t: any) => ({
      id: t.id ?? t._id,
      name: t.name ?? t.title ?? '(unnamed team)',
    }));
  }

  // ----- LIST (used to build the existing-items cache at meeting start) ---------------

  async listOpenIssues(teamId: string): Promise<ExistingItem[]> {
    // TODO_VERIFY: confirm path + query param shape from swagger.
    const res = await fetch(`${config.NINETY_API_BASE}/issues?teamId=${teamId}&status=open`, { headers: this.headers() });
    return this.parseList(res, 'issue');
  }

  async listOpenTodos(teamId: string): Promise<ExistingItem[]> {
    const res = await fetch(`${config.NINETY_API_BASE}/todos?teamId=${teamId}&status=open`, { headers: this.headers() });
    return this.parseList(res, 'todo');
  }

  async listUpcomingHeadlines(teamId: string): Promise<ExistingItem[]> {
    const res = await fetch(`${config.NINETY_API_BASE}/headlines?teamId=${teamId}&status=upcoming`, { headers: this.headers() });
    return this.parseList(res, 'headline');
  }

  // ----- CREATE ---------------------------------------------------------------------

  async createIssue(input: CreateIssueInput): Promise<NinetyWriteResult> {
    return this.post('/issues', input);
  }

  async createTodo(input: CreateTodoInput): Promise<NinetyWriteResult> {
    return this.post('/todos', input);
  }

  async createHeadline(input: CreateHeadlineInput): Promise<NinetyWriteResult> {
    return this.post('/headlines', input);
  }

  // ----- APPEND / UPDATE -----------------------------------------------------------

  /** Append IDS-structured notes to an existing Issue. */
  async appendIssueNotes(issueId: string, notesHtml: string): Promise<NinetyWriteResult> {
    return this.patch(`/issues/${issueId}`, { notesAppend: notesHtml });
  }

  async appendHeadlineDescription(headlineId: string, descriptionAppend: string): Promise<NinetyWriteResult> {
    return this.patch(`/headlines/${headlineId}`, { descriptionAppend });
  }

  async markTodoDone(todoId: string): Promise<NinetyWriteResult> {
    return this.patch(`/todos/${todoId}`, { status: 'done' });
  }

  /** Convert a Headline into an Issue. */
  async convertHeadlineToIssue(headlineId: string, teamId: string): Promise<NinetyWriteResult> {
    return this.post(`/headlines/${headlineId}/convert-to-issue`, { teamId });
  }

  // ----- internals -------------------------------------------------------------------

  private async post<T extends object>(path: string, body: T): Promise<NinetyWriteResult> {
    const res = await fetch(`${config.NINETY_API_BASE}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Ninety POST ${path} failed: ${res.status} ${await res.text()}`);
    const json: any = await res.json();
    return { id: json.id ?? json._id, url: json.url ?? '' };
  }

  private async patch<T extends object>(path: string, body: T): Promise<NinetyWriteResult> {
    const res = await fetch(`${config.NINETY_API_BASE}${path}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Ninety PATCH ${path} failed: ${res.status} ${await res.text()}`);
    const json: any = await res.json();
    return { id: json.id ?? json._id, url: json.url ?? '' };
  }

  private async parseList(res: Response, type: ItemType): Promise<ExistingItem[]> {
    if (!res.ok) throw new Error(`Ninety list ${type} failed: ${res.status} ${await res.text()}`);
    const json: any = await res.json();
    const items: any[] = Array.isArray(json) ? json : (json.items ?? json.data ?? []);
    return items.map((it: any) => ({
      id: it.id ?? it._id,
      type,
      title: it.title ?? it.name ?? '(untitled)',
      team: it.teamName ?? it.teamId ?? '',
      ageDescription: humanAge(it.createdAt ?? it.created),
      ninetyUrl: it.url,
    }));
  }
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
