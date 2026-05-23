import { useState } from 'react';
import { api } from '../lib/api.ts';

interface Props {
  meetingId: string;
  currentIssueId: string | null;
  currentIssueTitle: string | null;
  open: boolean;
  setOpen: (b: boolean) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_PROMPTS = [
  'Identify root causes',
  'Suggest discussion questions',
  "What's a good solve look like?",
  'Fast experiment ideas',
];

export function CoachFAB(props: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(content: string) {
    if (!content.trim() || busy) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setDraft('');
    setBusy(true);
    try {
      const { reply } = await api.idsCoach(props.meetingId, next, props.currentIssueId);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages([...next, { role: 'assistant', content: `(error: ${(e as Error).message})` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => props.setOpen(!props.open)}
        style={{
          position: 'fixed',
          bottom: 18,
          right: 18,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--ink)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
          zIndex: 50,
          fontSize: 18,
          fontWeight: 600,
          cursor: 'pointer',
          border: 'none',
          fontFamily: 'inherit',
        }}
        aria-label="Open IDS Coach"
      >
        ✦
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            fontFamily: 'var(--hand)',
            fontSize: 14,
            color: 'var(--brand)',
            background: 'white',
            borderRadius: '50%',
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--line)',
          }}
        >
          ✦
        </span>
      </button>

      {/* Panel */}
      {props.open && (
        <div
          style={{
            position: 'fixed',
            bottom: 76,
            right: 18,
            width: 360,
            height: 460,
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
            zIndex: 49,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Head */}
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--line-soft)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--ink)',
            }}
          >
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--brand-tint)',
                color: 'var(--brand)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
              }}
            >
              ✦
            </span>
            IDS Coach
            <button
              onClick={() => props.setOpen(false)}
              style={{
                marginLeft: 'auto',
                fontSize: 18,
                background: 'none',
                border: 'none',
                color: 'var(--ink-3)',
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Sub-strip */}
          {props.currentIssueTitle && (
            <div
              style={{
                padding: '6px 12px',
                fontSize: 11,
                color: 'var(--ink-2)',
                borderBottom: '1px solid var(--line-soft)',
                background: 'var(--paper-2)',
              }}
            >
              Coaching: <strong style={{ color: 'var(--ink)' }}>{props.currentIssueTitle}</strong>
            </div>
          )}

          {/* Body */}
          <div style={{ flex: 1, padding: 12, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && (
              <div style={{ color: 'var(--ink-3)', fontSize: 12, fontStyle: 'italic' }}>
                Ask me about root causes, framing, or solve options for the current issue.
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '8px 10px',
                  borderRadius: 'var(--r-md)',
                  fontSize: 12,
                  lineHeight: 1.4,
                  background: m.role === 'user' ? 'var(--brand)' : 'var(--paper-2)',
                  color: m.role === 'user' ? 'white' : 'var(--ink)',
                }}
              >
                {m.content}
              </div>
            ))}
            {busy && <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>thinking…</div>}
          </div>

          {/* Suggested prompts */}
          <div
            style={{
              padding: '6px 12px',
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              borderTop: '1px solid var(--line-soft)',
              background: 'var(--paper-2)',
            }}
          >
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => setDraft(p)}
                style={{
                  fontSize: 10.5,
                  padding: '3px 8px',
                  border: '1px solid var(--line)',
                  borderRadius: 999,
                  background: 'var(--paper)',
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            style={{
              borderTop: '1px solid var(--line-soft)',
              padding: '8px 10px',
              display: 'flex',
              gap: 6,
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask the coach…"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                font: 'inherit',
                background: 'transparent',
                color: 'var(--ink)',
                fontSize: 12,
              }}
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="btn primary"
              style={{ padding: '4px 10px', fontSize: 11 }}
            >
              →
            </button>
          </form>
        </div>
      )}
    </>
  );
}
