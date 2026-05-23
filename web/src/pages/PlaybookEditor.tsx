import { Link } from 'react-router-dom';

export function PlaybookEditor() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '14px 24px',
          borderBottom: '1px solid var(--line-soft)',
        }}
      >
        <Link to="/setup" style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--brand)' }}>90</span>
          <span style={{ color: 'var(--ink)' }}> notes</span>
        </Link>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-2)' }}>Playbooks</span>
      </header>

      <main style={{ flex: 1, padding: 40, background: 'var(--paper-2)', overflow: 'auto' }}>
        <div
          style={{
            maxWidth: 880,
            margin: '0 auto',
            background: 'var(--paper)',
            borderRadius: 'var(--r-lg)',
            padding: 32,
            boxShadow: '0 4px 14px rgba(38,38,38,0.08)',
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 8 }}>Playbook Editor</div>
          <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 24 }}>
            Section-by-section rules and annotated examples go here. Coming in Phase 5 of the build.
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
            For now, the meeting uses the default Operations L10 playbook hardcoded in the server.
          </div>
        </div>
      </main>
    </div>
  );
}
