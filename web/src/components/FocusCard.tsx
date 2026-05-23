import { useEffect, useState } from 'react';
import { InlineSelect } from './InlineSelect.tsx';
import { TypeChip } from './TypeChip.tsx';
import { UpdatingExistingIssueStrip, type MatchCandidate } from './UpdatingExistingIssueStrip.tsx';
import type { ItemType, MeetingItem } from '../lib/types.ts';

interface Props {
  item: MeetingItem;
  pendingCount: number;
  ownerOptions: string[];
  teamOptions: string[];
  candidates: MatchCandidate[];
  onApprove: (input: { mergeMode: boolean; matchedItemId: string | null; draft: MeetingItem['draft'] }) => void;
  onSkip: () => void;
  onJumpToTimestamp: (mmss: string) => void;
}

const TYPE_OPTIONS: Array<{ value: ItemType; label: string }> = [
  { value: 'issue', label: 'Issue' },
  { value: 'todo', label: 'To-Do' },
  { value: 'headline', label: 'Headline' },
];

export function FocusCard(props: Props) {
  const { item } = props;
  const [type, setType] = useState<ItemType>(item.type);
  const [title, setTitle] = useState(item.draft.title);
  const [owner, setOwner] = useState(item.draft.owner);
  const [team, setTeam] = useState(item.draft.team);
  const [notesHtml, setNotesHtml] = useState(item.draft.notesHtml);
  const [mergeMode, setMergeMode] = useState<boolean>(Boolean(item.matched_item_id));
  const [matchedIssue, setMatchedIssue] = useState<MatchCandidate | null>(
    item.matched_item_id ? props.candidates.find((c) => c.id === item.matched_item_id) ?? null : null,
  );

  // Reset local draft when a new item arrives in focus
  useEffect(() => {
    setType(item.type);
    setTitle(item.draft.title);
    setOwner(item.draft.owner);
    setTeam(item.draft.team);
    setNotesHtml(item.draft.notesHtml);
    setMergeMode(Boolean(item.matched_item_id));
    setMatchedIssue(item.matched_item_id ? props.candidates.find((c) => c.id === item.matched_item_id) ?? null : null);
  }, [item.id, item.matched_item_id, props.candidates]);

  const capturedAt = fmtTime(item.captured_at_seconds);

  const submitLabel = mergeMode && matchedIssue ? 'Approve & update issue' : 'Approve & push to Ninety';

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--paper-2)',
        padding: '20px 32px',
        overflow: 'auto',
        minHeight: 0,
      }}
    >
      {/* Eyebrow + question */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--warn)',
          }}
        >
          Needs your review · {props.pendingCount}
        </div>
        <div style={{ fontSize: 19, fontWeight: 500, color: 'var(--ink)', marginTop: 2 }}>
          Did you mean this as {indefiniteArticle(type)} {TYPE_OPTIONS.find((o) => o.value === type)?.label.toLowerCase()}?
        </div>
      </div>

      {/* Focus card */}
      <div
        style={{
          background: 'var(--paper)',
          borderRadius: 'var(--r-lg)',
          padding: '18px 22px',
          boxShadow: '0 4px 14px rgba(38,38,38,0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <InlineSelect<ItemType>
            value={type}
            options={TYPE_OPTIONS}
            onChange={setType}
            render={(v) => <TypeChip type={v} />}
            renderOption={({ value }) => <TypeChip type={value} />}
            width={140}
          />
          <span className="pill pending dot">needs review</span>
          <button
            onClick={() => props.onJumpToTimestamp(capturedAt)}
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--brand)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 6px',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brand-tint)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            ← captured at {capturedAt}
          </button>
        </div>

        {/* Updating existing issue strip */}
        {matchedIssue && (
          <UpdatingExistingIssueStrip
            mergeMode={mergeMode}
            setMergeMode={setMergeMode}
            matchedIssue={matchedIssue}
            candidates={props.candidates}
            onPickCandidate={(c) => {
              setMatchedIssue(c);
              setMergeMode(c !== null);
            }}
          />
        )}

        {/* Editable title */}
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => setTitle(e.currentTarget.textContent ?? '')}
          style={{
            fontSize: 19,
            fontWeight: 500,
            color: 'var(--ink)',
            outline: 'none',
            padding: '4px 6px',
            borderRadius: 'var(--r-sm)',
            transition: 'background 120ms ease, box-shadow 120ms ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.background = 'var(--paper-2)';
            e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--brand)';
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {title}
        </div>

        {/* Owner · Team */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 12, color: 'var(--ink-2)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--ink-3)' }}>Owner ·</span>
            <InlineSelect value={owner} options={props.ownerOptions} onChange={setOwner} width={160} />
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--ink-3)' }}>Team ·</span>
            <InlineSelect value={team} options={props.teamOptions} onChange={setTeam} width={180} />
          </span>
          {item.category && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '2px 6px',
                borderRadius: 3,
                background: 'var(--paper-3)',
                color: 'var(--ink-2)',
              }}
            >
              {item.category}
            </span>
          )}
        </div>

        {/* Notes */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>Notes</div>
          <div
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-sm)',
              overflow: 'hidden',
            }}
          >
            {/* Toolbar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                height: 28,
                padding: '0 6px',
                borderBottom: '1px solid var(--line-soft)',
                background: 'var(--paper-2)',
                fontSize: 11,
                color: 'var(--ink-3)',
              }}
            >
              <ToolbarBtn label="B" weight={700} />
              <ToolbarBtn label="I" italic />
              <ToolbarBtn label="U" underline />
              <ToolbarBtn label="S" strike />
              <span style={{ width: 1, height: 14, background: 'var(--line)', margin: '0 4px' }} />
              <ToolbarBtn label="•" />
              <ToolbarBtn label="1." />
              <ToolbarBtn label="↶" />
              <ToolbarBtn label="↷" />
              <span style={{ marginLeft: 'auto', fontSize: 10 }}>Auto-saved</span>
            </div>
            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setNotesHtml(e.currentTarget.innerHTML)}
              dangerouslySetInnerHTML={{ __html: notesHtml || idsPlaceholder() }}
              style={{
                padding: '12px 14px',
                fontSize: 12.5,
                color: 'var(--ink)',
                outline: 'none',
                minHeight: 100,
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn primary"
            onClick={() =>
              props.onApprove({
                mergeMode,
                matchedItemId: matchedIssue?.id ?? null,
                draft: { ...item.draft, type, title, owner, team, notesHtml },
              })
            }
          >
            {submitLabel}
          </button>
          <button onClick={props.onSkip} className="btn ghost">
            Skip — keep listening →
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolbarBtn({ label, weight, italic, underline, strike }: { label: string; weight?: number; italic?: boolean; underline?: boolean; strike?: boolean }) {
  return (
    <button
      type="button"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '2px 6px',
        borderRadius: 3,
        fontWeight: weight ?? 500,
        fontStyle: italic ? 'italic' : undefined,
        textDecoration: underline ? 'underline' : strike ? 'line-through' : undefined,
        color: 'var(--ink-2)',
        fontSize: 11,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--paper-3)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {label}
    </button>
  );
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function indefiniteArticle(t: ItemType): string {
  return t === 'issue' ? 'an' : 'a';
}

function idsPlaceholder(): string {
  return `<p><strong>Identify:</strong> </p><p><strong>Discuss:</strong> </p><p><strong>Solve:</strong> </p>`;
}
