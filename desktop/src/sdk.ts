/**
 * Recall Desktop SDK wrapper.
 *
 * SCAFFOLD STATE (task 8): stubbed — simulates the recording lifecycle so we can
 * verify tray/popover/IPC/backend wiring without the native module.
 *
 * Task 9 replaces the stub bodies with real calls:
 *   import RecallAiSdk from '@recallai/desktop-sdk';
 *   RecallAiSdk.init({ apiUrl });
 *   await RecallAiSdk.requestPermission('microphone' | 'screen_capture' | 'accessibility');
 *   const windowId = await RecallAiSdk.prepareDesktopAudioRecording();
 *   await RecallAiSdk.startRecording({ windowId, uploadToken });
 *   await RecallAiSdk.stopRecording({ windowId });
 *   RecallAiSdk.addEventListener('recording-started' | 'recording-ended' | ..., cb);
 */

export type RecordingState = 'idle' | 'starting' | 'recording' | 'stopping';

let state: RecordingState = 'idle';
let currentWindowId: string | null = null;
let onStateChange: ((s: RecordingState) => void) | null = null;

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

const REGION_URL = 'https://us-west-2.recall.ai';

export async function initSdk(): Promise<void> {
  // task 9: RecallAiSdk.init({ apiUrl: REGION_URL });
  void REGION_URL;
  console.log('[sdk:stub] init');
}

export async function requestAllPermissions(): Promise<void> {
  // task 9: request microphone, screen_capture, accessibility
  console.log('[sdk:stub] requestAllPermissions');
}

export async function startRecording(uploadToken: string): Promise<void> {
  setState('starting');
  // task 9:
  //   currentWindowId = await RecallAiSdk.prepareDesktopAudioRecording();
  //   await RecallAiSdk.startRecording({ windowId: currentWindowId, uploadToken });
  currentWindowId = `stub-window-${Date.now()}`;
  console.log('[sdk:stub] startRecording with token', uploadToken.slice(0, 8) + '…');
  setState('recording');
}

export async function stopRecording(): Promise<void> {
  setState('stopping');
  // task 9: if (currentWindowId) await RecallAiSdk.stopRecording({ windowId: currentWindowId });
  console.log('[sdk:stub] stopRecording', currentWindowId);
  currentWindowId = null;
  setState('idle');
}

export function shutdownSdk(): void {
  // task 9: RecallAiSdk.shutdown();
  console.log('[sdk:stub] shutdown');
}
