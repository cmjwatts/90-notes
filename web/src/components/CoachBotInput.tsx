import { useState } from 'react';
import { api } from '../lib/api.ts';

interface Props {
  meetingId: string;
}

/**
 * Slim inline input for steering the bot mid-meeting.
 * Distinct from the IDS Coach FAB: this writes to the LLM's coach-message buffer
 * so the next extraction call honors it.
 */
export function CoachBotInput({ meetingId }: Props) {
  const [draft, setDraft] = useState('');
  const [flash, setFlash] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    const msg = draft;
    setDraft('');
    try {
      await api.coachBot(meetingId, msg);
      setFlash('noted ✓');
      setTimeout(() => setFlash(null), 1800);
    } catch (err) {
      setFlash(`error: ${(err as Error).message}`);
    }
  }

  return (
    <form
      onSubmit={send}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: 'var(--paper)',
        border: '1px solid var(--line-soft)',
        borderRadius: 'var(--r-sm)',
        margin: '12px 0',
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
        Tell the bot
      </span>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder='e.g. "this belongs to Mark" · "we’re back on the NPS issue" · "stop creating headlines"'
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
      {flash && <span style={{ fontSize: 11, color: 'var(--good)', fontWeight: 600 }}>{flash}</span>}
      <button type="submit" className="btn ghost" style={{ fontSize: 11 }}>
        send
      </button>
    </form>
  );
}
