import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.ts';
import { TypeChip } from '../components/TypeChip.tsx';
import type { MeetingItem, MeetingNudge, TranscriptChunk } from '../lib/types.ts';

export function Recap() {
  const { meetingId = '' } = useParams();
  const [items, setItems] = useState<MeetingItem[]>([]);
  const [chunks, setChunks] = useState<TranscriptChunk[]>([]);
  const [cost, setCost] = useState<{ in: number; cached: number; out: number }>({ in: 0, cached: 0, out: 0 });
  const [nudges, setNudges] = useState<MeetingNudge[]>([]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    (async () => {
      const [{ data: rows }, { data: ch }, { data: events }, { data: nudgeRows }] = await Promise.all([
        supabase.from('meeting_items').select('*').eq('meeting_id', meetingId).order('created_at'),
        supabase.from('transcript_chunks').select('*').eq('meeting_id', meetingId).order('received_at'),
        supabase.from('meeting_cost_events').select('*').eq('meeting_id', meetingId),
        supabase.from('meeting_nudges').select('*').eq('meeting_id', meetingId),
      ]);
      if (!active) return;
      if (rows) setItems(rows as MeetingItem[]);
      if (ch) setChunks(ch as TranscriptChunk[]);
      if (events) {
        const c = { in: 0, cached: 0, out: 0 };
        for (const e of events as Array<{ input_tokens: number; cached_tokens: number; output_tokens: number }>) {
          c.in += e.input_tokens;
          c.cached += e.cached_tokens;
          c.out += e.output_tokens;
        }
        setCost(c);
      }
      if (nudgeRows) setNudges(nudgeRows as MeetingNudge[]);
    })();
    return () => { active = false; };
  }, [meetingId]);

  const finished = items.filter((it) => it.status === 'auto_created' || it.status === 'auto_appended' || it.status === 'approved');
  const skipped = items.filter((it) => it.status === 'skipped');

  // Rough USD estimate using public Sonnet 4.6 pricing: $3/M input, $0.30/M cached read, $15/M output.
  const estimatedUsd = ((cost.in - cost.cached) * 3 + cost.cached * 0.3 + cost.out * 15) / 1_000_000;

  const tangentsCaught = nudges.length;
  const tangentsDroppedDown = nudges.filter((n) => n.status === 'dropped_down').length;

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
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-2)' }}>Meeting recap</span>
      </header>

      <main style={{ flex: 1, padding: 40, background: 'var(--paper-2)', overflow: 'auto' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card title={`${finished.length} item${finished.length === 1 ? '' : 's'} added to Ninety`}>
            {finished.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>None.</div>}
            {finished.map((it) => (
              <div key={it.id} style={rowStyle}>
                <TypeChip type={it.type} />
                <span style={{ flex: 1 }}>{it.draft.title || '(appended)'}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{it.draft.owner}</span>
                {it.ninety_url && (
                  <a href={it.ninety_url} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)' }}>↗</a>
                )}
              </div>
            ))}
          </Card>

          {skipped.length > 0 && (
            <Card title={`${skipped.length} skipped`}>
              {skipped.map((it) => (
                <div key={it.id} style={rowStyle}>
                  <TypeChip type={it.type} />
                  <span style={{ flex: 1, color: 'var(--ink-3)' }}>{it.draft.title}</span>
                </div>
              ))}
            </Card>
          )}

          <Card title="Cost">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, fontSize: 12 }}>
              <Stat label="Input tokens" value={cost.in.toLocaleString()} />
              <Stat label="Cached tokens" value={cost.cached.toLocaleString()} />
              <Stat label="Output tokens" value={cost.out.toLocaleString()} />
              <Stat label="Estimated USD" value={`$${estimatedUsd.toFixed(3)}`} />
            </div>
          </Card>

          {tangentsCaught > 0 && (
            <Card title="Tangents">
              <div style={{ fontSize: 12.5, color: 'var(--ink)' }}>
                {tangentsCaught} tangent{tangentsCaught === 1 ? '' : 's'} caught · {tangentsDroppedDown} dropped to the Issues List
              </div>
            </Card>
          )}

          <Card title="Transcript">
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
              {chunks.reduce((n, c) => n + c.lines.length, 0)} lines · {chunks.length} chunks
            </div>
            <button
              onClick={() => downloadTranscript(meetingId, chunks)}
              className="btn"
              style={{ alignSelf: 'flex-start' }}
            >
              Download transcript (.txt)
            </button>
          </Card>
        </div>
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--paper)',
        borderRadius: 'var(--r-lg)',
        padding: '20px 24px',
        boxShadow: '0 4px 14px rgba(38,38,38,0.08)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--paper-2)', padding: '10px 12px', borderRadius: 'var(--r-sm)' }}>
      <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12.5,
  padding: '4px 0',
};

function downloadTranscript(meetingId: string, chunks: TranscriptChunk[]) {
  const lines: string[] = [];
  for (const c of chunks) {
    for (const l of c.lines) {
      lines.push(`[${fmt(l.startSeconds)}] ${l.speaker}: ${l.text}`);
    }
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `90-notes-${meetingId}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}
