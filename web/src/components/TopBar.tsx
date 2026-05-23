import { useEffect, useState } from 'react';
import { InlineSelect } from './InlineSelect.tsx';
import { SECTION_LABELS, type AgendaSection } from '../lib/types.ts';

interface Props {
  teamName: string;
  meetingType: string;
  meetingDateLabel: string;
  startedAt: number; // ms epoch
  botStatus: 'pending' | 'live' | 'ended' | 'failed';
  currentSection: AgendaSection;
  onSectionChange: (s: AgendaSection) => void;
  onEndMeeting: () => void;
}

export function TopBar(props: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (props.botStatus === 'ended') return;
    const tick = () => setElapsed(Math.floor((Date.now() - props.startedAt) / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [props.startedAt, props.botStatus]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '10px 16px',
        borderBottom: '1px solid var(--line-soft)',
        background: 'var(--paper)',
        flexShrink: 0,
        height: 56,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>
        <span style={{ color: 'var(--brand)' }}>90</span>
        <span style={{ color: 'var(--ink)' }}> notes</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)' }}>
        <span>{props.teamName}</span>
        <span style={{ color: 'var(--line)' }}>/</span>
        <span>{props.meetingType}</span>
        <span style={{ color: 'var(--line)' }}>·</span>
        <span>{props.meetingDateLabel}</span>
        <span style={{ color: 'var(--line)' }}>·</span>
        <span style={{ color: 'var(--ink-3)', textTransform: 'uppercase', fontSize: 10, fontWeight: 600, letterSpacing: '0.08em' }}>
          Section:
        </span>
        <InlineSelect<AgendaSection>
          value={props.currentSection}
          options={(Object.keys(SECTION_LABELS) as AgendaSection[]).map((v) => ({
            value: v,
            label: SECTION_LABELS[v],
          }))}
          onChange={props.onSectionChange}
          render={(v) => <strong style={{ color: 'var(--ink)' }}>{SECTION_LABELS[v]}</strong>}
        />
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <BotStatusPill status={props.botStatus} />
        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 500 }}>
          {fmtTimer(elapsed)}
        </span>
        <button
          onClick={props.onEndMeeting}
          style={{
            fontFamily: 'inherit',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '6px 12px',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--ink)',
            background: 'var(--ink)',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          End meeting
        </button>
      </div>
    </div>
  );
}

function BotStatusPill({ status }: { status: Props['botStatus'] }) {
  const color =
    status === 'live'
      ? 'var(--brand)'
      : status === 'pending'
        ? 'var(--warn)'
        : status === 'ended'
          ? 'var(--ink-3)'
          : 'var(--bad)';

  const label = status === 'live' ? 'Live' : status === 'pending' ? 'Joining…' : status === 'ended' ? 'Ended' : 'Failed';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 500,
        color: 'var(--ink-2)',
        padding: '4px 10px',
        borderRadius: 999,
        background: 'var(--paper-2)',
        border: '1px solid var(--line-soft)',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          boxShadow: status === 'live' ? `0 0 0 3px var(--brand-tint)` : 'none',
          animation: status === 'live' ? 'pulse 1.8s ease-in-out infinite' : undefined,
        }}
      />
      {label}
    </span>
  );
}

function fmtTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
