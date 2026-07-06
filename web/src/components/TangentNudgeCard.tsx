import type { MeetingNudge } from '../lib/types.ts';

interface Props {
  nudge: MeetingNudge;
  onDropDown: () => void;
  onDismiss: () => void;
  busy?: boolean;
}

export function TangentNudgeCard({ nudge, onDropDown, onDismiss, busy }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        background: 'var(--warn-tint)',
        borderLeft: '3px solid var(--warn)',
        borderBottom: '1px solid var(--warn)',
        color: 'var(--ink)',
        flexShrink: 0,
        fontSize: 12,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          padding: '2px 6px',
          background: 'var(--warn)',
          color: 'white',
          borderRadius: 3,
          flexShrink: 0,
        }}
      >
        Tangent
      </span>
      <span style={{ flex: 1, color: 'var(--ink)' }}>
        {/* The server message already opens with its own "Tangent alert 🙂 —" flourish. */}
        {nudge.message}
        {nudge.suggested_issue_title && (
          <span style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>
            → will add: {nudge.suggested_issue_title}
          </span>
        )}
      </span>
      <button
        onClick={onDropDown}
        disabled={busy}
        style={{
          fontSize: 11,
          fontWeight: 600,
          padding: '6px 12px',
          borderRadius: 'var(--r-sm)',
          border: 'none',
          background: 'var(--warn)',
          color: 'white',
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        Drop it down
      </button>
      <button
        onClick={onDismiss}
        disabled={busy}
        style={{
          fontSize: 11,
          fontWeight: 600,
          padding: '6px 12px',
          borderRadius: 'var(--r-sm)',
          border: '1px solid var(--line-soft)',
          background: 'var(--paper)',
          color: 'var(--ink-2)',
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        We're on topic
      </button>
    </div>
  );
}
