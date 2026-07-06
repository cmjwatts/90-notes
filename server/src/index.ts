import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { meetingsRouter } from './routes/meetings.js';
import { recallWebhookRouter } from './webhooks/recall.js';
import { itemsRouter } from './routes/items.js';
import { coachRouter } from './routes/coach.js';
import { ninetyRouter } from './routes/ninety.js';
import { desktopRouter } from './routes/desktop.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors({ origin: true, credentials: true }));

// Recall webhook needs the raw body for signature verification — register before the JSON parser.
app.use('/api/recall-webhook', express.raw({ type: 'application/json', limit: '2mb' }), recallWebhookRouter);

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: '90 notes', env: config.NODE_ENV });
});

/**
 * Shared-secret Bearer auth for the web-facing API — meetings/items/coach/ninety only.
 * Excludes /api/health, /api/recall-webhook (mounted above), and /api/desktop (own key).
 * The web app sends `Authorization: Bearer <APP_API_KEY>`. If APP_API_KEY is unset the
 * middleware is open (local dev); see the startup warning below.
 */
const requireAppKey = (req: Request, res: Response, next: NextFunction) => {
  if (!config.APP_API_KEY) return next(); // open for local dev
  const header = req.header('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  const expected = config.APP_API_KEY;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Unauthorized — bad or missing app key' });
  }
  next();
};

app.use('/api/meetings', requireAppKey, meetingsRouter);
app.use('/api/items', requireAppKey, itemsRouter);
app.use('/api/coach', requireAppKey, coachRouter);
app.use('/api/ninety', requireAppKey, ninetyRouter);
app.use('/api/desktop', desktopRouter);

// Serve the built web app in production (Vite outputs to web/dist).
if (config.NODE_ENV === 'production') {
  const webDist = path.resolve(__dirname, '../../web/dist');
  app.use(express.static(webDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

app.listen(config.PORT, () => {
  console.log(`[90 notes] listening on http://localhost:${config.PORT} (${config.NODE_ENV})`);
  if (!config.APP_API_KEY) {
    console.warn('[90 notes] ⚠ API is running WITHOUT auth — anyone who can reach it can start meetings and write to Ninety. Set APP_API_KEY for any deployed instance.');
  }
});
