import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Load the repo-root .env regardless of cwd — npm workspace scripts run with
// cwd=server/, so a bare `import 'dotenv/config'` never found it. Real env vars
// (e.g. Render's) always win: dotenv never overrides values already set.
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });
dotenv.config(); // also pick up a cwd-local .env if one exists

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  PUBLIC_BASE_URL: z.string().url(),

  ANTHROPIC_API_KEY: z.string().min(1),

  RECALL_API_KEY: z.string().min(1).optional(),
  RECALL_REGION: z.enum(['us-west-2', 'us-east-1', 'eu-central-1', 'ap-northeast-1']).default('us-west-2'),
  RECALL_WEBHOOK_URL: z.string().url(),
  RECALL_WEBHOOK_SECRET: z.string().min(8),

  NINETY_API_TOKEN: z.string().optional(),
  NINETY_API_BASE: z.string().url().default('https://api.public.ninety.io/v1'),

  // Shared secret the Mac menubar app sends as a Bearer token on /api/desktop/*.
  // Optional so the server still boots without desktop mode configured.
  DESKTOP_API_KEY: z.string().min(16).optional(),

  // Shared secret the web app sends as a Bearer token on /api/* (except health, webhook, desktop).
  // Optional so local dev still boots without it.
  APP_API_KEY: z.string().min(12).optional(),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('=========================================================');
    console.error(' Invalid environment configuration — server cannot start ');
    console.error('=========================================================');
    // Flat, one-line-per-problem listing (much easier to read than zod's nested format).
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '<root>';
      console.error(`  ✗ ${key}: ${issue.message}`);
    }
    console.error('---------------------------------------------------------');
    // Diagnostic: which expected keys are present and their lengths (NEVER values).
    const expectedKeys = [
      'NODE_ENV', 'PORT', 'PUBLIC_BASE_URL', 'ANTHROPIC_API_KEY',
      'RECALL_API_KEY', 'RECALL_REGION', 'RECALL_WEBHOOK_URL', 'RECALL_WEBHOOK_SECRET',
      'NINETY_API_TOKEN', 'NINETY_API_BASE',
      'APP_API_KEY',
      'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
    ];
    console.error(' Env vars detected (name : length in chars, or MISSING):');
    for (const key of expectedKeys) {
      const v = process.env[key];
      if (v === undefined) {
        console.error(`  - ${key}: MISSING`);
      } else if (v === '') {
        console.error(`  - ${key}: EMPTY STRING`);
      } else {
        // For URL fields, also show the first 30 chars so we can spot typos like missing https://
        const isUrl = /URL|BASE/.test(key);
        const preview = isUrl ? ` "${v.slice(0, 30)}${v.length > 30 ? '…' : ''}"` : '';
        console.error(`  - ${key}: ${v.length} chars${preview}`);
      }
    }
    console.error('=========================================================');
    throw new Error('Server cannot start — see env errors above. Did you copy .env.example to .env?');
  }
  return parsed.data;
}

export const config = loadConfig();
