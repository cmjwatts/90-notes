interface Props {
  copy: string; // e.g. "you've been on the NPS issue 11 min with no solution proposed. Time to move toward solve."
  onAskCoach: () => void;
  onDismiss: () => void;
}

export function IDSWarningBanner({ copy, onAskCoach, onDismiss }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        background: 'var(--ids-red-bg)',
        borderLeft: `3px solid var(--ids-red-accent)`,
        borderBottom: `1px solid var(--ids-red-accent)`,
        color: 'var(--ids-red-text)',
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
          background: 'var(--ids-red-accent)',
          color: 'white',
          borderRadius: 3,
          flexShrink: 0,
        }}
      >
        IDS
      </span>
      <span style={{ flex: 1, color: 'var(--ids-red-strong)' }}>
        <span style={{ fontFamily: 'var(--hand)', fontSize: 16, color: 'var(--ids-red-accent)', marginRight: 4 }}>
          heads up —
        </span>
        {copy}
      </span>
      <button
        onClick={onAskCoach}
        style={{
          fontSize: 11,
          fontWeight: 600,
          padding: '6px 12px',
          borderRadius: 'var(--r-sm)',
          border: 'none',
          background: 'var(--ids-red-accent)',
          color: 'white',
          cursor: 'pointer',
        }}
      >
        Ask coach for next step
      </button>
      <button
        onClick={onDismiss}
        style={{
          fontSize: 16,
          color: 'var(--ids-red-strong)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          lineHeight: 1,
          padding: '0 4px',
        }}
        aria-label="dismiss"
      >
        ×
      </button>
    </div>
  );
}
