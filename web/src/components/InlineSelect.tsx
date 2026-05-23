import { useEffect, useRef, useState, type ReactNode } from 'react';

interface InlineSelectProps<T extends string> {
  value: T;
  options: Array<T | { value: T; label: string }>;
  onChange: (v: T) => void;
  render?: (v: T) => ReactNode;
  renderOption?: (opt: { value: T; label: string }) => ReactNode;
  width?: number;
  className?: string;
}

export function InlineSelect<T extends string>(props: InlineSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <span ref={ref} className={props.className} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Click to change"
        style={{
          background: 'transparent',
          border: '1px dashed transparent',
          padding: '2px 6px',
          borderRadius: 4,
          cursor: 'pointer',
          font: 'inherit',
          color: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          transition: 'border-color 120ms ease, background 120ms ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
      >
        {props.render ? props.render(props.value) : props.value}
        <span style={{ fontSize: 9, color: 'var(--ink-3)', marginLeft: 2 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 50,
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
            padding: 4,
            minWidth: props.width ?? 160,
          }}
        >
          {props.options.map((opt) => {
            const val = typeof opt === 'string' ? opt : opt.value;
            const label = typeof opt === 'string' ? opt : opt.label;
            const active = val === props.value;
            return (
              <div
                key={val}
                onClick={() => {
                  props.onChange(val);
                  setOpen(false);
                }}
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  color: 'var(--ink)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: active ? 'var(--paper-2)' : 'transparent',
                  fontWeight: active ? 500 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brand-tint)')}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = active ? 'var(--paper-2)' : 'transparent')
                }
              >
                {props.renderOption
                  ? props.renderOption({ value: val, label })
                  : label}
                {active && <span style={{ marginLeft: 'auto', color: 'var(--brand)' }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </span>
  );
}
