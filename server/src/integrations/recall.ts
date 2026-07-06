import { config } from '../config.js';

const BASE = `https://${config.RECALL_REGION}.recall.ai/api/v1`;

interface CreateBotInput {
  meetingUrl: string;
  botName: string;
  meetingId: string; // our meeting ID, attached as bot metadata
}

interface CreateBotResponse {
  id: string;             // Recall bot id
  status_changes: Array<{ code: string; created_at: string }>;
}

/**
 * Dispatch a Recall.ai bot to join a meeting. Sets up real-time transcript delivery
 * to our webhook URL.
 *
 * Schema verified against https://docs.recall.ai/docs/bot-real-time-transcription.md
 * (current shape: recording_config.transcript.provider + recording_config.realtime_endpoints).
 */
export async function dispatchRecallBot(input: CreateBotInput): Promise<CreateBotResponse> {
  if (!config.RECALL_API_KEY) {
    throw new Error('RECALL_API_KEY not configured — set it in .env before starting a meeting.');
  }
  // Webhook secret travels as a token query param — Recall realtime endpoints
  // may not sign payloads, so this is our primary auth control (see webhooks/recall.ts).
  const url = new URL(config.RECALL_WEBHOOK_URL);
  url.searchParams.set('token', config.RECALL_WEBHOOK_SECRET);

  const body = {
    bot_name: input.botName,
    meeting_url: input.meetingUrl,
    metadata: { meeting_id: input.meetingId },
    recording_config: {
      transcript: {
        provider: {
          // Recall's built-in streaming transcription — fastest, no third-party setup required.
          recallai_streaming: {
            mode: 'prioritize_low_latency' as const,
            language_code: 'en' as const,
          },
        },
      },
      realtime_endpoints: [
        {
          type: 'webhook' as const,
          url: url.toString(),
          // Finals only — transcript.partial_data caused duplicate transcript text downstream.
          events: ['transcript.data'],
        },
      ],
    },
  };
  const res = await fetch(`${BASE}/bot/`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${config.RECALL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Recall.ai bot create failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<CreateBotResponse>;
}

/** Tell Recall the bot should leave the meeting. */
export async function leaveRecallBot(botId: string): Promise<void> {
  if (!config.RECALL_API_KEY) return;
  await fetch(`${BASE}/bot/${botId}/leave_call/`, {
    method: 'POST',
    headers: { Authorization: `Token ${config.RECALL_API_KEY}` },
  });
}
