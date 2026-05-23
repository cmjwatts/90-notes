import 'dotenv/config';
import { z } from 'zod';

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

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment configuration:');
    console.error(parsed.error.format());
    throw new Error('Server cannot start — see env errors above. Did you copy .env.example to .env?');
  }
  return parsed.data;
}

export const config = loadConfig();
