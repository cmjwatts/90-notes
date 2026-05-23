import { useEffect, useRef } from 'react';

export interface TranscriptLine {
  speaker: string;
  startSeconds: number;
  text: string;
  detected?: boolean;
}

interface Props {
  lines: TranscriptLine[];
  highlightTimeKey: string | null; // "MM:SS" to pulse the matching line
}

export function TranscriptPane({ lines, highlightTimeKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <aside
      style={{
        width: 360,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--line-soft)',
        background: 'var(--paper)',
        minHeight: 0,
      }}
    >
      <div className="pane-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        Transcript
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: 'var(--brand)',
            animation: 'pulse 1.6s ease-in-out infinite',
          }}
        />
      </div>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 24,
        }}
      >
        {lines.length === 0 ? (
          <div style={{ padding: '20px 14px', color: 'var(--ink-3)', fontSize: 12, fontStyle: 'italic' }}>
            Waiting for the bot to join the meeting…
          </div>
        ) : null}
        {lines.map((l, i) => {
          const key = fmtTime(l.startSeconds);
          const isJump = highlightTimeKey === key;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 10,
                padding: '8px 14px',
                fontSize: 12,
                lineHeight: 1.45,
                ...(l.detected
                  ? { background: 'var(--brand-tint)', borderLeft: '2px solid var(--brand)' }
                  : {}),
                ...(isJump
                  ? {
                      background: 'rgba(47,139,170,0.15)',
                      boxShadow: 'inset 3px 0 0 var(--brand)',
                      transition: 'background 200ms ease',
                    }
                  : { transition: 'background 600ms ease' }),
              }}
            >
              <span className="ph-avatar">{initials(l.speaker)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 11 }}>{l.speaker}</span>
                  <span style={{ color: 'var(--ink-3)', fontSize: 10, marginLeft: 6, fontVariantNumeric: 'tabular-nums' }}>
                    {key}
                  </span>
                </div>
                <div style={{ color: 'var(--ink)' }}>{l.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}
