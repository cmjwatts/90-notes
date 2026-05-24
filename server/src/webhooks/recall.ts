import { Router } from 'express';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { ingestTranscriptChunk } from '../orchestrator/meetingOrchestrator.js';
import type { TranscriptLine } from '../orchestrator/sessionState.js';

export const recallWebhookRouter = Router();

/**
 * Recall.ai POSTs transcript chunks here. Body comes in as raw Buffer
 * (express.raw at the mount point) so we can verify HMAC signatures.
 *
 * Payload shape (Recall API v1.11, verified Dec 2025):
 *   {
 *     event: "transcript.data" | "transcript.partial_data",
 *     data: {
 *       data: {
 *         words: [{ text, start_timestamp: { relative }, end_timestamp: { relative }|null }],
 *         language_code,
 *         participant: { id, name, is_host, ... }
 *       },
 *       realtime_endpoint: { id, metadata },
 *       transcript: { id, metadata },
 *       recording: { id, metadata },
 *       bot: { id, metadata }   ← our meeting_id is in bot.metadata
 *     }
 *   }
 */
recallWebhookRouter.post('/', async (req, res) => {
  const raw: Buffer = req.body;

  // Optional: signature check using the shared secret.
  if (config.RECALL_WEBHOOK_SECRET) {
    const signature = req.header('x-recall-signature');
    if (signature) {
      const expected = crypto.createHmac('sha256', config.RECALL_WEBHOOK_SECRET).update(raw).digest('hex');
      if (!safeEqual(signature, expected)) return res.status(401).json({ error: 'bad signature' });
    }
  }

  let payload: any;
  try { payload = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ error: 'invalid json' }); }

  const event = payload.event ?? payload.type;
  const envelope = payload.data ?? payload;        // outer "data" wrapper
  const innerData = envelope?.data ?? envelope;    // inner "data" with words/participant

  if (event === 'transcript.data' || event === 'transcript.partial_data') {
    const meetingId =
      envelope?.bot?.metadata?.meeting_id ??
      envelope?.metadata?.meeting_id;
    if (!meetingId) {
      console.warn('[recall webhook] no meeting_id in metadata; ignoring');
      return res.json({ ok: true, ignored: 'no meeting_id' });
    }

    const lines: TranscriptLine[] = extractLines(innerData);
    if (!lines.length) return res.json({ ok: true, ignored: 'empty' });

    // Deterministic chunk id for idempotency: bot id + first word timestamp + speaker.
    // (Recall doesn't ship an explicit event id for transcript.data.)
    const firstWord = innerData?.words?.[0];
    const ts = firstWord?.start_timestamp?.relative ?? Date.now() / 1000;
    const chunkId =
      envelope?.transcript?.id && firstWord
        ? `${envelope.transcript.id}-${ts}-${event}`
        : crypto.randomUUID();

    ingestTranscriptChunk({ meetingId, chunkId, lines });
    return res.json({ ok: true });
  }

  // Log other events for visibility (participant joins, etc.).
  console.log('[recall webhook] event:', event);
  res.json({ ok: true });
});

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

interface RecallWord {
  text?: string;
  start_timestamp?: { relative?: number };
  end_timestamp?: { relative?: number } | null;
}

function extractLines(data: any): TranscriptLine[] {
  const words: RecallWord[] | undefined = data?.words;
  if (!Array.isArray(words) || words.length === 0) return [];

  const speaker: string = data?.participant?.name ?? 'Unknown';
  const firstStart = Number(words[0]?.start_timestamp?.relative ?? 0);
  const text = words
    .map((w) => w.text ?? '')
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return [];
  return [{ speaker, startSeconds: firstStart, text }];
}
