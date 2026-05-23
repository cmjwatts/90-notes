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
 * Recall webhook payload (real-time transcription) shape — verified against:
 *   https://docs.recall.ai/docs/bot-real-time-transcription
 * Adjust if the shape differs in practice.
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
  const data = payload.data ?? payload;

  if (event === 'transcript.data' || event === 'transcript.partial_data') {
    const meetingId = data?.bot?.metadata?.meeting_id ?? data?.metadata?.meeting_id;
    if (!meetingId) return res.json({ ok: true, ignored: 'no meeting_id' });

    const chunkId = data?.id ?? data?.chunk_id ?? crypto.randomUUID();
    const lines: TranscriptLine[] = extractLines(data);

    ingestTranscriptChunk({ meetingId, chunkId, lines });
    return res.json({ ok: true });
  }

  // bot status events — log; orchestrator can subscribe later.
  if (event?.startsWith?.('bot.status')) {
    console.log('[recall] bot status:', event, data?.status_code ?? data?.status);
  }

  res.json({ ok: true });
});

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function extractLines(data: any): TranscriptLine[] {
  // Real-time payload typically has data.words[] with speaker + start_time.
  // Fall back to data.transcript if structured already.
  const words = data?.words;
  if (Array.isArray(words) && words.length) {
    // Group consecutive same-speaker words into one line.
    const lines: TranscriptLine[] = [];
    for (const w of words) {
      const speaker = w.speaker ?? w.participant?.name ?? 'Unknown';
      const start = Number(w.start_time ?? w.start ?? 0);
      const text = String(w.text ?? '');
      const last = lines[lines.length - 1];
      if (last && last.speaker === speaker) {
        last.text += (last.text.endsWith(' ') ? '' : ' ') + text;
      } else {
        lines.push({ speaker, startSeconds: start, text });
      }
    }
    return lines;
  }
  if (typeof data?.transcript === 'string') {
    return [{ speaker: data?.speaker ?? 'Unknown', startSeconds: 0, text: data.transcript }];
  }
  return [];
}
