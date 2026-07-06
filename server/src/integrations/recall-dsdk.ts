import { config } from '../config.js';

const BASE = `https://${config.RECALL_REGION}.recall.ai/api/v1`;

interface CreateSdkUploadResponse {
  id: string;
  uploadToken: string;
}

/**
 * Create a Recall Desktop SDK Upload. Returns an upload_token that the desktop
 * app passes to RecallAiSdk.startRecording().
 *
 * Verified against https://docs.recall.ai/reference/sdk_upload_create.md
 *   POST /api/v1/sdk_upload/
 *   body: { recording_config: { transcript: { provider }, realtime_endpoints[] }, metadata }
 *   resp: { id, upload_token, ... }
 *
 * Transcripts are delivered to our existing webhook (config.RECALL_WEBHOOK_URL),
 * tagged with meeting_id in the realtime endpoint metadata so the orchestrator
 * routes them to the right session — identical downstream path to the bot.
 */
export async function createSdkUpload(input: { meetingId: string }): Promise<CreateSdkUploadResponse> {
  if (!config.RECALL_API_KEY) {
    throw new Error('RECALL_API_KEY not configured — required to create a desktop SDK upload.');
  }

  // Webhook secret travels as a token query param — Recall realtime endpoints
  // may not sign payloads, so this is our primary auth control (see webhooks/recall.ts).
  const url = new URL(config.RECALL_WEBHOOK_URL);
  url.searchParams.set('token', config.RECALL_WEBHOOK_SECRET);

  const body = {
    recording_config: {
      transcript: {
        provider: {
          recallai_streaming: {},
        },
      },
      realtime_endpoints: [
        {
          type: 'webhook',
          url: url.toString(),
          // Finals only — transcript.partial_data caused duplicate transcript text downstream.
          events: ['transcript.data'],
          // metadata travels back on every event so the webhook can route to the session.
          metadata: { meeting_id: input.meetingId },
        },
      ],
    },
    // Top-level metadata as a second place the meeting_id may appear in payloads.
    metadata: { meeting_id: input.meetingId },
  };

  const res = await fetch(`${BASE}/sdk_upload/`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${config.RECALL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Recall create SDK upload failed (${res.status}): ${await res.text()}`);
  }
  const json: any = await res.json();
  const uploadToken = json.upload_token ?? json.uploadToken;
  if (!uploadToken) {
    throw new Error(`Recall SDK upload response missing upload_token: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return { id: json.id, uploadToken };
}
