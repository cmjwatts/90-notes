import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

export const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

export const HOT_LOOP_MODEL = 'claude-sonnet-4-6';
export const COLD_LOOP_MODEL = 'claude-sonnet-4-6';
export const COACH_MODEL = 'claude-sonnet-4-6';
