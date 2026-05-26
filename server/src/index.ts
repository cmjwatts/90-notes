import express from 'express';
import cors from 'cors';
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

app.use('/api/meetings', meetingsRouter);
app.use('/api/items', itemsRouter);
app.use('/api/coach', coachRouter);
app.use('/api/ninety', ninetyRouter);
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
});
