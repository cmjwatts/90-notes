import { app, Tray, BrowserWindow, ipcMain, shell, nativeImage } from 'electron';
import { join } from 'node:path';
import { loadConfig, saveConfig, isConfigured, type AppConfig } from './config.js';
import { createSession, endSession, listTeams } from './backend.js';
import * as sdk from './sdk.js';

let tray: Tray | null = null;
let popover: BrowserWindow | null = null;
let config: AppConfig = { backendUrl: '', apiKey: '', defaultTeamId: '', defaultPlaybookId: '' };
let currentMeetingId: string | null = null;

const POPOVER_WIDTH = 320;
const POPOVER_HEIGHT = 300;

function trayTitleFor(state: sdk.RecordingState): string {
  switch (state) {
    case 'recording': return ' ● REC';
    case 'starting': return ' ◌ …';
    case 'stopping': return ' ◌ …';
    default: return ' ✦';
  }
}

function updateTray(state: sdk.RecordingState): void {
  if (!tray) return;
  tray.setTitle(trayTitleFor(state));
  tray.setToolTip(state === 'recording' ? '90 notes — recording' : '90 notes');
}

function createPopover(): BrowserWindow {
  const win = new BrowserWindow({
    width: POPOVER_WIDTH,
    height: POPOVER_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(join(__dirname, 'renderer', 'index.html'));
  win.on('blur', () => win.hide());
  return win;
}

function togglePopover(): void {
  if (!popover) return;
  if (popover.isVisible()) {
    popover.hide();
    return;
  }
  positionPopover();
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

app.whenReady().then(async () => {
  if (process.platform === 'darwin') app.dock?.hide();

  config = loadConfig();
  await sdk.initSdk();

  // Tray uses a text title (✦ / ● REC) — avoids shipping icon assets in the scaffold.
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle(trayTitleFor('idle'));
  tray.setToolTip('90 notes');
  tray.on('click', togglePopover);
  tray.on('right-click', togglePopover);

  popover = createPopover();

  sdk.onState((state) => updateTray(state));
});

app.on('window-all-closed', () => {
  // Menubar app — intentionally do nothing so the app keeps running in the tray
  // when the popover hides. (On macOS the default is already to stay alive.)
});

app.on('before-quit', () => {
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

ipcMain.handle('app:quit', () => app.quit());
