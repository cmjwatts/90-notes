import { contextBridge, ipcRenderer } from 'electron';

export interface AppConfig {
  backendUrl: string;
  apiKey: string;
  defaultTeamId: string;
  defaultPlaybookId: string;
  permissionsAcknowledged: boolean;
}

contextBridge.exposeInMainWorld('api', {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('config:get'),
  saveConfig: (cfg: AppConfig): Promise<{ ok: boolean; configured: boolean }> =>
    ipcRenderer.invoke('config:save', cfg),
  listTeams: (backendUrl: string): Promise<Array<{ id: string; name: string }>> =>
    ipcRenderer.invoke('teams:list', backendUrl),
  getState: (): Promise<{ state: string; meetingId: string | null; configured: boolean; config: AppConfig }> =>
    ipcRenderer.invoke('recording:state'),
  startRecording: (): Promise<{ meetingId: string }> => ipcRenderer.invoke('recording:start'),
  stopRecording: (): Promise<{ meetingId: string | null }> => ipcRenderer.invoke('recording:stop'),
  openMeeting: (meetingId: string): Promise<void> => ipcRenderer.invoke('meeting:open', meetingId),
  requestPermissions: (): Promise<{ ok: boolean }> => ipcRenderer.invoke('permissions:request'),
  openPermissionSettings: (pane: string): Promise<void> => ipcRenderer.invoke('permissions:openSettings', pane),
  quit: (): Promise<void> => ipcRenderer.invoke('app:quit'),
});
