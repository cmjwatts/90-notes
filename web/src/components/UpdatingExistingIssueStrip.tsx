import { useEffect, useRef, useState } from 'react';

export interface MatchCandidate {
  id: string;
  title: string;
  team: string;
  age: string;
  match: number; // 0–1
}

interface Props {
  mergeMode: boolean;
  setMergeMode: (b: boolean) => void;
  matchedIssue: MatchCandidate | null;
  candidates: MatchCandidate[];
  onPickCandidate: (c: MatchCandidate | null) => void; // null = create new
}

export function UpdatingExistingIssueStrip(props: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pickerOpen]);

  if (!props.matchedIssue) return null;

  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        background: 'var(--brand-tint)',
        borderRadius: 'var(--r-sm)',
        position: 'relative',
        fontSize: 12,
      }}
    >
      <input
        type="checkbox"
        checked={props.mergeMode}
        onChange={(e) => props.setMergeMode(e.target.checked)}
        style={{ cursor: 'pointer' }}
      />
      <span style={{ color: 'var(--ink-2)' }}>Updating existing issue:</span>
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        style={{ color: 'var(--brand)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {props.matchedIssue.title}
      </a>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--good)',
          background: 'var(--good-tint)',
          padding: '2px 6px',
          borderRadius: 3,
          flexShrink: 0,
        }}
      >
        {Math.round(props.matchedIssue.match * 100)}% match
      </span>
      <button
        type="button"
        onClick={() => setPickerOpen((o) => !o)}
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--brand)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        change ▾
      </button>

      {pickerOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 50,
            width: 360,
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)',
            boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
            padding: 4,
          }}
        >
          {props.candidates.map((c) => (
            <div
              key={c.id}
              onClick={() => {
                props.onPickCandidate(c);
                setPickerOpen(false);
              }}
              style={{
                padding: '8px 10px',
                cursor: 'pointer',
                borderRadius: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--paper-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', flex: 1 }}>{c.title}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--good)',
                    background: 'var(--good-tint)',
                    padding: '1px 6px',
                    borderRadius: 3,
                  }}
                >
                  {Math.round(c.match * 100)}%
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                {c.team} · {c.age}
              </div>
            </div>
          ))}

          <div
            onClick={() => {
              props.onPickCandidate(null);
              setPickerOpen(false);
            }}
            style={{
              padding: '8px 10px',
              cursor: 'pointer',
              borderRadius: 4,
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--brand)',
              borderTop: '1px solid var(--line-soft)',
              marginTop: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brand-tint)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            + Create as new issue instead
          </div>
        </div>
      )}
    </div>
  );
}
