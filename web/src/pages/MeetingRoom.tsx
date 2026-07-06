import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '../components/TopBar.tsx';
import { IDSWarningBanner } from '../components/IDSWarningBanner.tsx';
import { TangentNudgeCard } from '../components/TangentNudgeCard.tsx';
import { TranscriptPane } from '../components/TranscriptPane.tsx';
import { FocusCard } from '../components/FocusCard.tsx';
import { ApprovedList } from '../components/ApprovedList.tsx';
import { CoachFAB } from '../components/CoachFAB.tsx';
import { CoachBotInput } from '../components/CoachBotInput.tsx';
import { api } from '../lib/api.ts';
import { supabase, supabaseEnabled } from '../lib/supabase.ts';
import type { AgendaSection, IDSInsight, MeetingItem, MeetingNudge, TranscriptChunk } from '../lib/types.ts';
import type { TranscriptLine } from '../components/TranscriptPane.tsx';
import type { MatchCandidate } from '../components/UpdatingExistingIssueStrip.tsx';

const OWNERS = ['Mark R.', 'John T.', 'Sarah P.', 'Christine V.', 'Unassigned'];
const TEAMS = ['Operations', 'Leadership', 'Sales', 'Product', 'Customer Success'];

export function MeetingRoom() {
  const { meetingId = '' } = useParams();
  const navigate = useNavigate();

  const [items, setItems] = useState<MeetingItem[]>([]);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [insight, setInsight] = useState<IDSInsight | null>(null);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [nudge, setNudge] = useState<MeetingNudge | null>(null);
  const [nudgeBusy, setNudgeBusy] = useState(false);
  const [section, setSection] = useState<AgendaSection>('segue');
  const [coachOpen, setCoachOpen] = useState(false);
  const [jumpKey, setJumpKey] = useState<string | null>(null);
  const [startedAt] = useState<number>(() => Date.now());

  // Load initial state + subscribe
  useEffect(() => {
    if (!supabase) return;
    let active = true;

    (async () => {
      const [{ data: rows }, { data: chunks }, { data: insights }, { data: nudges }] = await Promise.all([
        supabase.from('meeting_items').select('*').eq('meeting_id', meetingId).order('created_at'),
        supabase.from('transcript_chunks').select('*').eq('meeting_id', meetingId).order('received_at'),
        supabase
          .from('ids_insights')
          .select('*')
          .eq('meeting_id', meetingId)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('meeting_nudges')
          .select('*')
          .eq('meeting_id', meetingId)
          .eq('status', 'suggested')
          .order('created_at', { ascending: false })
          .limit(1),
      ]);
      if (!active) return;
      if (rows) setItems(rows as MeetingItem[]);
      if (chunks) setTranscript(flattenChunks(chunks as TranscriptChunk[]));
      if (insights?.[0]) setInsight(insights[0] as IDSInsight);
      setNudge((nudges?.[0] as MeetingNudge | undefined) ?? null);
    })();

    const itemsCh = supabase
      .channel(`items-${meetingId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_items', filter: `meeting_id=eq.${meetingId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setItems((prev) => [...prev, payload.new as MeetingItem]);
        } else if (payload.eventType === 'UPDATE') {
          setItems((prev) => prev.map((it) => (it.id === (payload.new as MeetingItem).id ? (payload.new as MeetingItem) : it)));
        } else if (payload.eventType === 'DELETE') {
          setItems((prev) => prev.filter((it) => it.id !== (payload.old as MeetingItem).id));
        }
      })
      .subscribe();

    const txCh = supabase
      .channel(`tx-${meetingId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transcript_chunks', filter: `meeting_id=eq.${meetingId}` }, (payload) => {
        const c = payload.new as TranscriptChunk;
        setTranscript((prev) => [...prev, ...c.lines]);
      })
      .subscribe();

    const insightCh = supabase
      .channel(`insight-${meetingId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ids_insights', filter: `meeting_id=eq.${meetingId}` }, (payload) => {
        setInsight(payload.new as IDSInsight);
        setWarningDismissed(false);
      })
      .subscribe();

    const nudgeCh = supabase
      .channel(`nudge-${meetingId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_nudges', filter: `meeting_id=eq.${meetingId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as MeetingNudge;
          if (row.status === 'suggested') setNudge(row);
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new as MeetingNudge;
          setNudge((prev) => (prev && prev.id === row.id && row.status !== 'suggested' ? null : prev));
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase!.removeChannel(itemsCh);
      supabase!.removeChannel(txCh);
      supabase!.removeChannel(insightCh);
      supabase!.removeChannel(nudgeCh);
    };
  }, [meetingId]);

  const pending = items.filter((it) => it.status === 'pending_review');
  const focusItem = pending[0] ?? null;
  const approved = items.filter((it) => it.status === 'auto_created' || it.status === 'auto_appended' || it.status === 'approved');

  const candidates: MatchCandidate[] = useMemo(() => {
    // For V1: derive candidates from the item itself when matched.
    // Phase 2 — replace with a real candidates fetch from the existing-items cache.
    if (!focusItem?.matched_item_id) return [];
    return [
      {
        id: focusItem.matched_item_id,
        title: focusItem.draft.title || '(matched item)',
        team: focusItem.draft.team,
        age: 'recent',
        match: focusItem.match_confidence ?? 0,
      },
    ];
  }, [focusItem]);

  async function onChangeSection(s: AgendaSection) {
    setSection(s);
    try { await api.setSection(meetingId, s); } catch (e) { console.warn(e); }
  }

  async function onEndMeeting() {
    if (!confirm('End meeting? The bot will leave the call.')) return;
    try { await api.endMeeting(meetingId); } catch (e) { console.warn(e); }
    navigate(`/recap/${meetingId}`);
  }

  async function onApprove(input: { mergeMode: boolean; matchedItemId: string | null; draft: MeetingItem['draft'] }) {
    if (!focusItem) return;
    try {
      await api.approveItem(focusItem.id, {
        draft: { ...input.draft, matchedItemId: input.matchedItemId },
        mergeMode: input.mergeMode,
        category: focusItem.category,
      });
    } catch (e) {
      alert(`Approve failed: ${(e as Error).message}`);
    }
  }

  async function onSkip() {
    if (!focusItem) return;
    try { await api.skipItem(focusItem.id); } catch (e) { console.warn(e); }
  }

  async function onUndo(itemId: string) {
    try { await api.undoItem(itemId); } catch (e) { console.warn(e); }
  }

  function onJumpToTimestamp(mmss: string) {
    setJumpKey(mmss);
    setTimeout(() => setJumpKey(null), 2400);
  }

  async function onNudgeDropDown() {
    if (!nudge) return;
    setNudgeBusy(true);
    try {
      await api.resolveNudge(nudge.id, 'dropped_down');
      setNudge(null);
    } catch (e) {
      alert(`Drop it down failed: ${(e as Error).message}`);
    } finally {
      setNudgeBusy(false);
    }
  }

  async function onNudgeDismiss() {
    if (!nudge) return;
    setNudgeBusy(true);
    try {
      await api.resolveNudge(nudge.id, 'dismissed');
      setNudge(null);
    } catch (e) {
      console.warn(e);
    } finally {
      setNudgeBusy(false);
    }
  }

  const showWarning = insight?.should_warn && insight.warning_copy && !warningDismissed;

  // The current issue is the most recent issue-type approved/auto item.
  const currentIssue =
    [...items].reverse().find((it) => it.type === 'issue' && (it.status === 'auto_created' || it.status === 'auto_appended' || it.status === 'approved')) ?? null;

  return (
    <div className="wf">
      <TopBar
        teamName="Operations Team"
        meetingType="L10"
        meetingDateLabel={fmtDate()}
        startedAt={startedAt}
        botStatus="live"
        currentSection={section}
        onSectionChange={onChangeSection}
        onEndMeeting={onEndMeeting}
      />

      {showWarning && (
        <IDSWarningBanner
          copy={insight!.warning_copy!}
          onAskCoach={() => setCoachOpen(true)}
          onDismiss={() => setWarningDismissed(true)}
        />
      )}

      {nudge && (
        <TangentNudgeCard
          nudge={nudge}
          onDropDown={onNudgeDropDown}
          onDismiss={onNudgeDismiss}
          busy={nudgeBusy}
        />
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <TranscriptPane lines={transcript} highlightTimeKey={jumpKey} />

        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          {section === 'ids' && insight?.current_issue_title && (
            <div
              style={{
                padding: '6px 32px 0',
                fontSize: 11,
                color: 'var(--ink-3)',
              }}
            >
              Solving: {insight.current_issue_title}
            </div>
          )}

          {focusItem ? (
            <FocusCard
              item={focusItem}
              pendingCount={pending.length}
              ownerOptions={OWNERS}
              teamOptions={TEAMS}
              candidates={candidates}
              onApprove={onApprove}
              onSkip={onSkip}
              onJumpToTimestamp={onJumpToTimestamp}
            />
          ) : (
            <EmptyFocus />
          )}

          {!supabaseEnabled && (
            <div
              style={{
                margin: '0 32px',
                padding: '8px 12px',
                background: 'var(--warn-tint)',
                border: '1px solid var(--warn)',
                borderRadius: 'var(--r-sm)',
                color: 'var(--warn)',
                fontSize: 11.5,
              }}
            >
              Supabase env vars missing — realtime updates won't flow until VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set.
            </div>
          )}

          <div style={{ padding: '0 32px 24px' }}>
            <CoachBotInput meetingId={meetingId} />
            <ApprovedList items={approved} onUndo={onUndo} />
          </div>
        </main>
      </div>

      <CoachFAB
        meetingId={meetingId}
        currentIssueId={currentIssue?.ninety_id ?? currentIssue?.matched_item_id ?? null}
        currentIssueTitle={currentIssue?.draft.title ?? null}
        open={coachOpen}
        setOpen={setCoachOpen}
      />
    </div>
  );
}

function EmptyFocus() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        color: 'var(--ink-3)',
        gap: 8,
      }}
    >
      <span style={{ fontFamily: 'var(--hand)', fontSize: 22, color: 'var(--brand)' }}>listening…</span>
      <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 360 }}>
        The bot is monitoring the transcript. When it catches something that needs your decision, it'll appear here as a card.
      </div>
    </div>
  );
}

function flattenChunks(chunks: TranscriptChunk[]): TranscriptLine[] {
  const out: TranscriptLine[] = [];
  for (const c of chunks) {
    for (const l of c.lines) out.push({ speaker: l.speaker, startSeconds: l.startSeconds, text: l.text });
  }
  return out;
}

function fmtDate(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
