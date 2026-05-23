import { anthropic, HOT_LOOP_MODEL } from '../integrations/anthropic.js';
import { buildCachedSystemPrompt, buildUserTurn } from './playbookPrompt.js';
import type { SessionState } from '../orchestrator/sessionState.js';

const TOOLS = [
  {
    name: 'create_issue',
    description: 'Create a NEW Issue in Ninety. Use only when no existing Issue matches.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' },
        owner: { type: 'string', description: 'Speaker who raised it, or "Unassigned"' },
        notes_identify: { type: 'string', description: 'Bold-prefixed paragraph for "Identify:"' },
        notes_discuss: { type: 'string', description: 'Paraphrased bullets for "Discuss:"' },
        notes_solve: { type: 'string', description: 'Single chosen action for "Solve:"' },
        category: { type: 'string', enum: ['people', 'process', 'system', 'customer', 'strategy'] },
        explicit: { type: 'boolean' },
        captured_at_seconds: { type: 'number' },
      },
      required: ['title', 'explicit', 'captured_at_seconds'],
    },
  },
  {
    name: 'append_to_issue',
    description: 'Append IDS notes to an EXISTING Issue (use the id from <existing_items>).',
    input_schema: {
      type: 'object' as const,
      properties: {
        issue_id: { type: 'string' },
        match_confidence: { type: 'number', minimum: 0, maximum: 1 },
        notes_identify: { type: 'string' },
        notes_discuss: { type: 'string' },
        notes_solve: { type: 'string' },
        explicit: { type: 'boolean' },
        captured_at_seconds: { type: 'number' },
      },
      required: ['issue_id', 'match_confidence', 'explicit', 'captured_at_seconds'],
    },
  },
  {
    name: 'create_todo',
    description: 'Create a NEW To-Do (often the Solve of an IDS Issue).',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' },
        owner: { type: 'string' },
        due_on: { type: 'string', description: 'ISO date if mentioned, else omit' },
        explicit: { type: 'boolean' },
        captured_at_seconds: { type: 'number' },
      },
      required: ['title', 'explicit', 'captured_at_seconds'],
    },
  },
  {
    name: 'mark_todo_complete',
    description: 'Mark an existing To-Do done.',
    input_schema: {
      type: 'object' as const,
      properties: {
        todo_id: { type: 'string' },
        captured_at_seconds: { type: 'number' },
      },
      required: ['todo_id', 'captured_at_seconds'],
    },
  },
  {
    name: 'create_headline',
    description: 'Create a NEW Headline.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        kind: { type: 'string', enum: ['customer', 'employee', 'cascade'] },
        explicit: { type: 'boolean' },
        captured_at_seconds: { type: 'number' },
      },
      required: ['title', 'explicit', 'captured_at_seconds'],
    },
  },
  {
    name: 'append_to_headline',
    description: 'Append context to an existing Headline.',
    input_schema: {
      type: 'object' as const,
      properties: {
        headline_id: { type: 'string' },
        match_confidence: { type: 'number' },
        description_append: { type: 'string' },
        captured_at_seconds: { type: 'number' },
      },
      required: ['headline_id', 'match_confidence', 'description_append', 'captured_at_seconds'],
    },
  },
  {
    name: 'convert_headline_to_issue',
    description: 'When a Headline becomes a question/issue, convert it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        headline_id: { type: 'string' },
        new_issue_title: { type: 'string' },
        captured_at_seconds: { type: 'number' },
      },
      required: ['headline_id', 'new_issue_title', 'captured_at_seconds'],
    },
  },
];

export interface HotLoopResult {
  toolCalls: Array<{ name: string; input: any }>;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
}

export async function runHotLoop(opts: {
  session: SessionState;
  playbookText: string;
  latestBuffer: string;
}): Promise<HotLoopResult> {
  const system = buildCachedSystemPrompt({
    playbookText: opts.playbookText,
    existingItems: opts.session.existingItems,
  });

  const userTurn = buildUserTurn(opts.session, opts.latestBuffer);

  const resp = await anthropic.messages.create({
    model: HOT_LOOP_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: system,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: TOOLS,
    messages: [{ role: 'user', content: userTurn }],
  });

  const toolCalls = resp.content
    .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    .map((b) => ({ name: b.name, input: b.input }));

  return {
    toolCalls,
    inputTokens: resp.usage.input_tokens,
    cachedTokens: resp.usage.cache_read_input_tokens ?? 0,
    outputTokens: resp.usage.output_tokens,
  };
}

import type Anthropic from '@anthropic-ai/sdk';
