import { app, Tray, BrowserWindow, ipcMain, shell, nativeImage } from 'electron';
import { join } from 'node:path';
import { loadConfig, saveConfig, isConfigured, type AppConfig } from './config.js';
import { createSession, endSession, listTeams } from './backend.js';
import * as sdk from './sdk.js';

let tray: Tray | null = null;
let popover: BrowserWindow | null = null;
let config: AppConfig = { backendUrl: '', apiKey: '', defaultTeamId: '', defaultPlaybookId: '', permissionsAcknowledged: false };
let currentMeetingId: string | null = null;
let quitting = false;

const POPOVER_WIDTH = 320;
const POPOVER_HEIGHT = 300;

function trayTitleFor(state: sdk.RecordingState): string {
  switch (state) {
    case 'recording': return ' ● REC';
    case 'starting': return ' …';
    case 'stopping': return ' …';
    default: return ''; // idle → icon only
  }
}

function updateTray(state: sdk.RecordingState): void {
  if (!tray) return;
  tray.setTitle(trayTitleFor(state));
  tray.setToolTip(state === 'recording' ? '90 notes — recording' : '90 notes');
}

function trayIcon(): Electron.NativeImage {
  const img = nativeImage.createFromPath(join(__dirname, 'assets', 'trayTemplate.png'));
  img.setTemplateImage(true); // macOS auto-inverts for light/dark menubar
  return img;
}

function createPopover(): BrowserWindow {
  const win = new BrowserWindow({
    width: POPOVER_WIDTH,
    height: POPOVER_HEIGHT,
    show: false,
    // Framed, normal window — reliably reachable via the Dock even when the
    // menubar icon is hidden behind the notch / a menubar manager.
    frame: true,
    title: '90 notes',
    resizable: true,
    minWidth: 300,
    minHeight: 280,
    fullscreenable: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(join(__dirname, 'renderer', 'index.html'));
  // Hide (not close) when the user closes the window, so the app keeps running.
  win.on('close', (e) => {
    if (!quitting) { e.preventDefault(); win.hide(); }
  });
  return win;
}

function togglePopover(): void {
  if (!popover) return;
  if (popover.isVisible()) {
    popover.hide();
    return;
  }
  popover.center();
  popover.show();
  popover.focus();
}

function positionPopover(): void {
  if (!tray || !popover) return;
  const trayBounds = tray.getBounds();
  const winBounds = popover.getBounds();
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height + 4);
  popover.setPosition(x, y, false);
}

app.whenReady().then(() => {
  config = loadConfig();

  // ── Diagnostics ────────────────────────────────────────────────────────────
  const icon = trayIcon();
  const size = icon.getSize();
  console.log(`[main] icon loaded: empty=${icon.isEmpty()} size=${size.width}x${size.height}`);

  try {
    tray = new Tray(icon);
    tray.setTitle(trayTitleFor('idle'));
    tray.setToolTip('90 notes');
    tray.on('click', togglePopover);
    tray.on('right-click', togglePopover);
    console.log('[main] tray created OK');
  } catch (e) {
    console.error('[main] tray creation FAILED:', e);
  }

  popover = createPopover();
  sdk.onState((state) => updateTray(state));

  // FALLBACK: keep the Dock icon visible and pop the window open on launch, so the
  // app is reachable even if the menubar icon is hidden (notch overflow / Bartender).
  if (process.platform === 'darwin') app.dock?.show();
  popover.once('ready-to-show', () => {
    if (popover) {
      popover.center();
      popover.show();
    }
  });

  sdk.initSdk().catch((e) => console.error('[main] SDK init failed:', e));
});

app.on('activate', () => {
  // Clicking the Dock icon re-opens the window.
  if (popover) { popover.center(); popover.show(); }
});

app.on('window-all-closed', () => {
  // Menubar app — intentionally do nothing so the app keeps running in the tray
  // when the popover hides. (On macOS the default is already to stay alive.)
});

app.on('before-quit', () => {
  quitting = true;
  sdk.shutdownSdk();
});

// ── IPC ──────────────────────────────────────────────────────────────────────────

ipcMain.handle('config:get', () => config);

ipcMain.handle('config:save', (_e, next: AppConfig) => {
  config = next;
  saveConfig(config);
  return { ok: true, configured: isConfigured(config) };
});

ipcMain.handle('teams:list', async (_e, backendUrl: string) => {
  return listTeams({ backendUrl: backendUrl || config.backendUrl });
});

ipcMain.handle('recording:state', () => ({
  state: sdk.getState(),
  meetingId: currentMeetingId,
  configured: isConfigured(config),
  config,
}));

ipcMain.handle('recording:start', async () => {
  if (!isConfigured(config)) throw new Error('Not configured');
  const session = await createSession(config);
  currentMeetingId = session.meetingId;
  await sdk.startRecording(session.uploadToken);
  return { meetingId: session.meetingId };
});

ipcMain.handle('recording:stop', async () => {
  await sdk.stopRecording();
  if (currentMeetingId) await endSession(config, currentMeetingId);
  const ended = currentMeetingId;
  currentMeetingId = null;
  return { meetingId: ended };
});

ipcMain.handle('meeting:open', (_e, meetingId: string) => {
  if (!config.backendUrl) return;
  shell.openExternal(`${config.backendUrl}/meeting/${meetingId}`);
});

ipcMain.handle('permissions:request', async () => {
  await sdk.requestAllPermissions();
  return { ok: true };
});

// Deep-link the user to the exact macOS privacy pane when a permission was denied.
ipcMain.handle('permissions:openSettings', (_e, pane: string) => {
  const map: Record<string, string> = {
    microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
    'screen-recording': 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
    accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  };
  shell.openExternal(map[pane] ?? 'x-apple.systempreferences:com.apple.preference.security?Privacy');
});

ipcMain.handle('app:quit', () => app.quit());
