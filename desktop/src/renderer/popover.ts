export {}; // make this file a module so `declare global` is allowed

interface AppConfig {
  backendUrl: string;
  apiKey: string;
  defaultTeamId: string;
  defaultPlaybookId: string;
  permissionsAcknowledged: boolean;
}

interface StateResp {
  state: 'idle' | 'starting' | 'recording' | 'stopping';
  meetingId: string | null;
  configured: boolean;
  config: AppConfig;
}

declare global {
  interface Window {
    api: {
      getConfig(): Promise<AppConfig>;
      saveConfig(cfg: AppConfig): Promise<{ ok: boolean; configured: boolean }>;
      listTeams(backendUrl: string): Promise<Array<{ id: string; name: string }>>;
      getState(): Promise<StateResp>;
      startRecording(): Promise<{ meetingId: string }>;
      stopRecording(): Promise<{ meetingId: string | null }>;
      openMeeting(meetingId: string): Promise<void>;
      requestPermissions(): Promise<{ ok: boolean }>;
      openPermissionSettings(pane: string): Promise<void>;
      quit(): Promise<void>;
    };
  }
}

const main = document.getElementById('main')!;
const gear = document.getElementById('gear')!;
const quitBtn = document.getElementById('quit')!;

let view: 'home' | 'settings' | 'permissions' = 'home';
let recordingStartedAt: number | null = null;
let timerHandle: number | null = null;

quitBtn.addEventListener('click', () => window.api.quit());
gear.addEventListener('click', () => {
  view = view === 'settings' ? 'home' : 'settings';
  render();
});

async function render(): Promise<void> {
  const s = await window.api.getState();
  if (view === 'permissions') {
    renderPermissions(s.config);
  } else if (view === 'settings' || !s.configured) {
    renderSettings(s.config, !s.configured);
  } else if (!s.config.permissionsAcknowledged) {
    renderPermissions(s.config);
  } else {
    renderHome(s);
  }
}

// ── Permissions step ──────────────────────────────────────────────────────────────
function renderPermissions(cfg: AppConfig): void {
  main.innerHTML = '';

  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.innerHTML =
    'To capture your meeting locally, 90 notes needs macOS permissions. ' +
    'Click <b>Grant access</b> — macOS will ask you to allow each one. ' +
    'For audio from other people, allow <b>Screen&nbsp;Recording</b>.';
  main.appendChild(hint);

  const list = document.createElement('div');
  list.className = 'muted';
  list.style.lineHeight = '1.7';
  list.innerHTML = '• Microphone (your voice)<br/>• Screen Recording (other participants’ audio)<br/>• Accessibility (speaker labels)';
  main.appendChild(list);

  const grant = document.createElement('button');
  grant.className = 'big-btn start';
  grant.textContent = 'Grant access';
  grant.addEventListener('click', async () => {
    grant.disabled = true;
    grant.textContent = 'Check the macOS dialogs…';
    await window.api.requestPermissions();
    grant.disabled = false;
    grant.textContent = 'Grant access';
  });
  main.appendChild(grant);

  const openSettings = document.createElement('button');
  openSettings.className = 'link';
  openSettings.textContent = 'Open macOS Privacy settings';
  openSettings.addEventListener('click', () => window.api.openPermissionSettings('screen-recording'));
  main.appendChild(openSettings);

  const done = document.createElement('button');
  done.className = 'big-btn start';
  done.style.background = 'var(--good)';
  done.textContent = "I've granted them — continue";
  done.addEventListener('click', async () => {
    await window.api.saveConfig({ ...cfg, permissionsAcknowledged: true });
    view = 'home';
    render();
  });
  main.appendChild(done);
}

// ── Home view ──────────────────────────────────────────────────────────────────
function renderHome(s: StateResp): void {
  const recording = s.state === 'recording';
  const busy = s.state === 'starting' || s.state === 'stopping';

  main.innerHTML = '';

  const teamLine = document.createElement('div');
  teamLine.className = 'muted';
  teamLine.textContent = recording ? 'Capturing this meeting locally — no bot in the call.' : 'Ready. Start your meeting, then hit record.';
  main.appendChild(teamLine);

  if (recording) {
    const pill = document.createElement('div');
    pill.className = 'recording-pill';
    pill.innerHTML = '<span class="status-dot"></span> Recording';
    main.appendChild(pill);

    const timer = document.createElement('div');
    timer.className = 'timer';
    timer.id = 'timer';
    timer.textContent = '0:00';
    main.appendChild(timer);
    startTimer();
  } else {
    stopTimer();
  }

  const btn = document.createElement('button');
  btn.className = `big-btn ${recording ? 'stop' : 'start'}`;
  btn.textContent = busy ? '…' : recording ? 'Stop recording' : 'Start recording';
  btn.disabled = busy;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      if (recording) {
        await window.api.stopRecording();
        recordingStartedAt = null;
      } else {
        recordingStartedAt = Date.now();
        await window.api.startRecording();
      }
    } catch (e) {
      showError((e as Error).message);
    }
    render();
  });
  main.appendChild(btn);

  if (recording && s.meetingId) {
    const open = document.createElement('button');
    open.className = 'link';
    open.textContent = 'Open Meeting Room →';
    open.addEventListener('click', () => window.api.openMeeting(s.meetingId!));
    main.appendChild(open);
  }
}

function startTimer(): void {
  if (timerHandle) return;
  timerHandle = window.setInterval(() => {
    const el = document.getElementById('timer');
    if (!el || !recordingStartedAt) return;
    const sec = Math.floor((Date.now() - recordingStartedAt) / 1000);
    el.textContent = `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
  }, 1000);
}
function stopTimer(): void {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
}

// ── Settings / first-run view ────────────────────────────────────────────────────
function renderSettings(cfg: AppConfig, firstRun: boolean): void {
  main.innerHTML = '';

  if (firstRun) {
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'First-time setup: paste your 90 notes web address and access key, then pick your default team.';
    main.appendChild(hint);
  }

  const urlLabel = field('90 notes web address', 'url', cfg.backendUrl, 'https://nine0-notes.onrender.com');
  const keyLabel = field('Access key (DESKTOP_API_KEY)', 'password', cfg.apiKey, '');
  main.appendChild(urlLabel.label);
  main.appendChild(keyLabel.label);

  const teamLabel = document.createElement('label');
  teamLabel.textContent = 'Default team';
  const teamSelect = document.createElement('select');
  teamSelect.id = 'team';
  teamSelect.innerHTML = '<option value="">— load teams —</option>';
  teamLabel.appendChild(teamSelect);
  main.appendChild(teamLabel);

  const loadBtn = document.createElement('button');
  loadBtn.className = 'link';
  loadBtn.textContent = 'Load teams from server';
  loadBtn.addEventListener('click', async () => {
    try {
      const teams = await window.api.listTeams(urlLabel.input.value.trim());
      teamSelect.innerHTML = teams.map((t: { id: string; name: string }) => `<option value="${t.id}">${t.name}</option>`).join('');
      if (cfg.defaultTeamId) teamSelect.value = cfg.defaultTeamId;
    } catch (e) {
      showError(`Couldn't load teams: ${(e as Error).message}`);
    }
  });
  main.appendChild(loadBtn);

  const save = document.createElement('button');
  save.className = 'big-btn start';
  save.textContent = 'Save';
  save.addEventListener('click', async () => {
    const next: AppConfig = {
      backendUrl: urlLabel.input.value.trim().replace(/\/$/, ''),
      apiKey: keyLabel.input.value.trim(),
      defaultTeamId: teamSelect.value,
      defaultPlaybookId: cfg.defaultPlaybookId || 'pb-l10-ops',
      permissionsAcknowledged: cfg.permissionsAcknowledged,
    };
    if (!next.backendUrl || !next.apiKey || !next.defaultTeamId) {
      showError('Fill in all three fields (and load + pick a team).');
      return;
    }
    await window.api.saveConfig(next);
    // First run → go to the permissions step; otherwise back home.
    view = next.permissionsAcknowledged ? 'home' : 'permissions';
    render();
  });
  main.appendChild(save);

  // Auto-load teams if a URL is already present.
  if (cfg.backendUrl) loadBtn.click();
}

function field(labelText: string, type: string, value: string, placeholder: string) {
  const label = document.createElement('label');
  label.textContent = labelText;
  const input = document.createElement('input');
  input.type = type === 'url' ? 'text' : type;
  input.value = value;
  input.placeholder = placeholder;
  label.appendChild(input);
  return { label, input };
}

function showError(msg: string): void {
  let err = document.getElementById('err');
  if (!err) {
    err = document.createElement('div');
    err.id = 'err';
    err.className = 'err';
    main.appendChild(err);
  }
  err.textContent = msg;
}

render();
