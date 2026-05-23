import { TypeChip } from './TypeChip.tsx';
import type { MeetingItem } from '../lib/types.ts';

interface Props {
  items: MeetingItem[];
  onUndo: (itemId: string) => void;
}

const AUTO_LOGGED_LABEL = 'Approved & added';

export function ApprovedList({ items, onUndo }: Props) {
  if (items.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
          padding: '0 0 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>{AUTO_LOGGED_LABEL} · this meeting</span>
        <span style={{ color: 'var(--line)' }}>·</span>
        <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--ink-3)', fontWeight: 500, fontSize: 10 }}>
          tap to undo
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((it) => (
          <div
            key={it.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 12px',
              fontSize: 11.5,
              cursor: 'pointer',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--paper-3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onClick={() => onUndo(it.id)}
            title="Click to undo"
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: it.status === 'auto_created' || it.status === 'auto_appended' ? 'var(--good)' : 'var(--brand)',
                flexShrink: 0,
              }}
            />
            <TypeChip type={it.type} />
            <span
              style={{
                flex: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: 'var(--ink)',
              }}
            >
              {it.draft.title || (it.matched_item_id ? '(appended to existing)' : '(untitled)')}
            </span>
            <span style={{ fontSize: 10, color: 'var(--ink-2)' }}>{it.draft.owner}</span>
            {it.ninety_url && (
              <a
                href={it.ninety_url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ color: 'var(--brand)', fontSize: 12, marginLeft: 2 }}
                title="Open in Ninety"
              >
                ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
