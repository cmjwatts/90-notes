import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.ts';

interface NamedRef { id: string; name: string }

export function MeetingSetup() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<NamedRef[]>([]);
  const [playbooks, setPlaybooks] = useState<NamedRef[]>([]);
  const [teamsErr, setTeamsErr] = useState<string | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(true);

  const [meetingUrl, setMeetingUrl] = useState('');
  const [teamId, setTeamId] = useState('');
  const [playbookId, setPlaybookId] = useState('');
  const [botName, setBotName] = useState('90 notes');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [t, p] = await Promise.all([api.listTeams(), api.listPlaybooks()]);
        if (!active) return;
        setTeams(t.teams);
        setPlaybooks(p.playbooks);
        if (t.teams[0]) setTeamId(t.teams[0].id);
        if (p.playbooks[0]) setPlaybookId(p.playbooks[0].id);
      } catch (e) {
        if (!active) return;
        setTeamsErr((e as Error).message);
      } finally {
        if (active) setLoadingTeams(false);
      }
    })();
    return () => { active = false; };
  }, []);

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
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                style={inputStyle}
                disabled={loadingTeams || teams.length === 0}
              >
                {loadingTeams && <option>Loading from Ninety…</option>}
                {!loadingTeams && teams.length === 0 && <option value="">(no teams found)</option>}
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Playbook" grow>
              <select value={playbookId} onChange={(e) => setPlaybookId(e.target.value)} style={inputStyle}>
                {playbooks.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
          </div>

          {teamsErr && (
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--warn)',
                background: 'var(--warn-tint)',
                padding: '8px 10px',
                borderRadius: 'var(--r-sm)',
                borderLeft: '2px solid var(--warn)',
              }}
            >
              Couldn't load teams from Ninety: <strong>{teamsErr}</strong>. The Ninety API endpoint or auth probably needs verification (Phase 0). Meeting will still try to start — but items won't write to Ninety until this resolves.
            </div>
          )}

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
