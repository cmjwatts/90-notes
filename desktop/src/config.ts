import { app, safeStorage } from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface AppConfig {
  backendUrl: string;   // e.g. https://nine0-notes.onrender.com
  apiKey: string;       // DESKTOP_API_KEY
  defaultTeamId: string;
  defaultPlaybookId: string;
}

const EMPTY: AppConfig = { backendUrl: '', apiKey: '', defaultTeamId: '', defaultPlaybookId: '' };

function configPath(): string {
  return join(app.getPath('userData'), 'config.enc');
}

/**
 * Settings are stored encrypted at rest via Electron's safeStorage (backed by the
 * macOS Keychain). The API key never touches plain text on disk.
 */
export function loadConfig(): AppConfig {
  const p = configPath();
  if (!existsSync(p)) return { ...EMPTY };
  try {
    const blob = readFileSync(p);
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(blob)
      : blob.toString('utf8');
    return { ...EMPTY, ...JSON.parse(json) };
  } catch (e) {
    console.error('[config] failed to load:', e);
    return { ...EMPTY };
  }
}

export function saveConfig(cfg: AppConfig): void {
  const json = JSON.stringify(cfg);
  const blob = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json)
    : Buffer.from(json, 'utf8');
  writeFileSync(configPath(), blob);
}

export function isConfigured(cfg: AppConfig): boolean {
  return Boolean(cfg.backendUrl && cfg.apiKey && cfg.defaultTeamId);
}
