import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.ts';

const TEAMS = [
  { id: 'team-operations', name: 'Operations Team' },
  { id: 'team-leadership', name: 'Leadership Team' },
  { id: 'team-sales', name: 'Sales Team' },
];

const PLAYBOOKS = [
  { id: 'pb-l10-ops', name: 'Operations Team L10' },
  { id: 'pb-l10-leadership', name: 'Leadership L10' },
  { id: 'pb-quarterly', name: 'Quarterly Planning' },
];

export function MeetingSetup() {
  const navigate = useNavigate();
  const [meetingUrl, setMeetingUrl] = useState('');
  const [teamId, setTeamId] = useState(TEAMS[0]!.id);
  const [playbookId, setPlaybookId] = useState(PLAYBOOKS[0]!.id);
  const [botName, setBotName] = useState('90 notes');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onStart(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { meetingId } = await api.startMeeting({ meetingUrl, teamId, playbookId, botName });
      navigate(`/meeting/${meetingId}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Slim top bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '14px 24px',
          borderBottom: '1px solid var(--line-soft)',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--brand)' }}>90</span>
          <span style={{ color: 'var(--ink)' }}> notes</span>
        </div>
        <nav style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 12 }}>
          <Link to="/playbooks">Playbooks</Link>
        </nav>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          background: 'var(--paper-2)',
        }}
      >
        <form
          onSubmit={onStart}
          style={{
            width: 520,
            background: 'var(--paper)',
            borderRadius: 'var(--r-lg)',
            padding: 32,
            boxShadow: '0 4px 14px rgba(38,38,38,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--brand)',
              }}
            >
              Start a meeting
            </div>
            <div style={{ fontSize: 20, fontWeight: 500, marginTop: 4 }}>Paste your Zoom URL, pick a playbook, go.</div>
          </div>

          <Field label="Zoom URL">
            <input
              type="url"
              required
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://zoom.us/j/123456789"
              style={inputStyle}
            />
          </Field>

          <div style={{ display: 'flex', gap: 14 }}>
            <Field label="Team" grow>
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={inputStyle}>
                {TEAMS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Playbook" grow>
              <select value={playbookId} onChange={(e) => setPlaybookId(e.target.value)} style={inputStyle}>
                {PLAYBOOKS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Bot name (shown to attendees)">
            <input value={botName} onChange={(e) => setBotName(e.target.value)} style={inputStyle} />
          </Field>

          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-3)',
              padding: '8px 10px',
              background: 'var(--paper-3)',
              borderRadius: 'var(--r-sm)',
              borderLeft: '2px solid var(--brand)',
            }}
          >
            A bot named "<strong>{botName}</strong>" will join the meeting and capture transcript. Let attendees know
            you're recording.
          </div>

          {err && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--ids-red-strong)',
                background: 'var(--ids-red-bg)',
                padding: '8px 10px',
                borderRadius: 'var(--r-sm)',
                borderLeft: '2px solid var(--ids-red-accent)',
              }}
            >
              {err}
            </div>
          )}

          <button type="submit" disabled={busy} className="btn primary" style={{ alignSelf: 'flex-start', padding: '10px 18px', fontSize: 13 }}>
            {busy ? 'Starting…' : 'Start meeting'}
          </button>
        </form>
      </main>
    </div>
  );
}

function Field({ label, grow, children }: { label: string; grow?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: grow ? 1 : undefined }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', letterSpacing: '0.02em' }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-sm)',
  padding: '8px 10px',
  font: 'inherit',
  fontSize: 13,
  color: 'var(--ink)',
  background: 'var(--paper)',
  outline: 'none',
};
