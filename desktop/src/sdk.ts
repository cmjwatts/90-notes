/**
 * Recall Desktop SDK wrapper — REAL integration (verified against the installed
 * @recallai/desktop-sdk@2.0.15 type definitions in node_modules/.../index.d.ts).
 *
 * Flow for manual-start desktop audio capture (any meeting / in-person):
 *   init({ apiUrl })
 *   requestPermission('microphone' | 'system-audio' | 'accessibility')
 *   windowId = await prepareDesktopAudioRecording()
 *   startRecording({ windowId, uploadToken })   // streams to Recall → transcripts webhook to our backend
 *   stopRecording({ windowId })
 *
 * Transcripts are delivered to our backend via the SDK upload's realtime webhook
 * (configured server-side in recall-dsdk.ts), so we do NOT handle 'realtime-event' here.
 */
import RecallAiSdk, { type Permission } from '@recallai/desktop-sdk';

export type RecordingState = 'idle' | 'starting' | 'recording' | 'stopping';

let state: RecordingState = 'idle';
let currentWindowId: string | null = null;
let onStateChange: ((s: RecordingState) => void) | null = null;
let initialized = false;

// Region base URL — must match the Recall workspace region (pay-as-you-go = us-west-2).
const REGION_URL = 'https://us-west-2.recall.ai';

const REQUIRED_PERMISSIONS: Permission[] = ['microphone', 'system-audio', 'accessibility'];

export function getState(): RecordingState {
  return state;
}

export function onState(cb: (s: RecordingState) => void): void {
  onStateChange = cb;
}

function setState(s: RecordingState): void {
  state = s;
  onStateChange?.(s);
}

export async function initSdk(): Promise<void> {
  if (initialized) return;
  await RecallAiSdk.init({ apiUrl: REGION_URL });
  initialized = true;

  RecallAiSdk.addEventListener('recording-started', () => setState('recording'));
  RecallAiSdk.addEventListener('recording-ended', () => {
    currentWindowId = null;
    setState('idle');
  });
  RecallAiSdk.addEventListener('error', (e) => {
    console.error('[sdk] error event:', e.type, e.message);
  });
  RecallAiSdk.addEventListener('shutdown', () => {
    initialized = false;
    setState('idle');
  });
}

/** Request mic / system-audio / accessibility. Safe to call repeatedly. */
export async function requestAllPermissions(): Promise<void> {
  for (const p of REQUIRED_PERMISSIONS) {
    try {
      await RecallAiSdk.requestPermission(p);
    } catch (e) {
      console.warn(`[sdk] requestPermission(${p}) failed:`, (e as Error).message);
    }
  }
}

export async function startRecording(uploadToken: string): Promise<void> {
  setState('starting');
  try {
    // Whole-desktop audio capture — works for any meeting app or in-person.
    currentWindowId = await RecallAiSdk.prepareDesktopAudioRecording();
    await RecallAiSdk.startRecording({ windowId: currentWindowId, uploadToken });
    // State flips to 'recording' on the 'recording-started' event.
  } catch (e) {
    setState('idle');
    currentWindowId = null;
    throw e;
  }
}

export async function stopRecording(): Promise<void> {
  if (!currentWindowId) {
    setState('idle');
    return;
  }
  setState('stopping');
  try {
    await RecallAiSdk.stopRecording({ windowId: currentWindowId });
    // State flips to 'idle' on the 'recording-ended' event; force it as a fallback.
  } finally {
    currentWindowId = null;
    setState('idle');
  }
}

export function shutdownSdk(): void {
  if (!initialized) return;
  RecallAiSdk.shutdown().catch(() => {});
  initialized = false;
}
