-- 90 notes — Supabase schema
-- Run in Supabase SQL Editor (project → SQL → New query).
-- Single-tenant V1: RLS open. Re-tighten when multi-user.

create extension if not exists "pgcrypto";

-- ───────── Meetings ─────────────────────────────────────────────────────────────
create table if not exists meetings (
  id            uuid primary key default gen_random_uuid(),
  team_id       text not null,
  playbook_id   text,                       -- slug like "pb-l10-leadership" until Playbook Editor exists
  recall_bot_id text,
  meeting_url   text not null,
  status        text not null default 'pending', -- pending | live | ended | failed
  created_at    timestamptz not null default now(),
  ended_at      timestamptz
);
-- For existing databases created before this change, run:
-- alter table meetings alter column playbook_id type text;
create index if not exists idx_meetings_status on meetings(status);

-- ───────── Playbooks ────────────────────────────────────────────────────────────
create table if not exists playbooks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  body        text not null,            -- the playbook system prompt body
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists playbook_sections (
  id          uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references playbooks(id) on delete cascade,
  section     text not null,           -- 'segue' | 'scorecard' | etc.
  rules       text not null,
  posture     text not null default 'normal'
);

create table if not exists playbook_examples (
  id          uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references playbooks(id) on delete cascade,
  section     text,
  transcript_excerpt text not null,
  ideal_output text not null            -- JSON or markdown describing the right output
);

-- ───────── Transcript chunks ────────────────────────────────────────────────────
create table if not exists transcript_chunks (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references meetings(id) on delete cascade,
  chunk_id    text not null,                  -- Recall-provided id; idempotency key
  lines       jsonb not null,                  -- [{speaker, startSeconds, text}, ...]
  received_at timestamptz not null default now()
);
create unique index if not exists uq_chunk on transcript_chunks(chunk_id);
create index if not exists idx_chunks_meeting on transcript_chunks(meeting_id, received_at);

-- ───────── Meeting items (Cards) ────────────────────────────────────────────────
create table if not exists meeting_items (
  id                   uuid primary key default gen_random_uuid(),
  meeting_id           uuid not null references meetings(id) on delete cascade,
  type                 text not null,                 -- 'issue' | 'todo' | 'headline'
  status               text not null,                 -- pending_review | auto_created | auto_appended | approved | skipped | failed
  draft                jsonb not null,                -- DraftItem
  matched_item_id      text,                          -- Ninety id when appending
  match_confidence     numeric,
  captured_at_seconds  numeric not null default 0,
  category             text,                          -- people | process | system | customer | strategy
  ninety_id            text,
  ninety_url           text,
  extra                jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);
create index if not exists idx_items_meeting on meeting_items(meeting_id, created_at);
create index if not exists idx_items_status on meeting_items(meeting_id, status);

-- ───────── Coach messages ───────────────────────────────────────────────────────
create table if not exists coach_messages (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  role       text not null,                  -- user | assistant | ids_coach
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_coach_meeting on coach_messages(meeting_id, created_at);

-- ───────── IDS insights (cold loop output) ──────────────────────────────────────
create table if not exists ids_insights (
  id                   uuid primary key default gen_random_uuid(),
  meeting_id           uuid not null references meetings(id) on delete cascade,
  ids_phase            text,
  minutes_on_issue     numeric,
  root_cause_concern   boolean,
  category             text,
  should_warn          boolean,
  warning_copy         text,
  coaching_suggestions jsonb,
  created_at           timestamptz not null default now()
);
create index if not exists idx_insights_meeting on ids_insights(meeting_id, created_at);

-- ───────── Cost ledger ──────────────────────────────────────────────────────────
create table if not exists meeting_cost_events (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid not null references meetings(id) on delete cascade,
  kind          text not null,             -- hot_loop | cold_loop | coach
  input_tokens  integer not null default 0,
  cached_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_cost_meeting on meeting_cost_events(meeting_id);

-- ───────── Manual-edit diff log (training signal) ───────────────────────────────
create table if not exists manual_edit_diffs (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references meeting_items(id) on delete cascade,
  field       text not null,                  -- 'title' | 'notes' | 'type' | 'owner'
  before_text text,
  after_text  text,
  created_at  timestamptz not null default now()
);

-- ───────── Realtime: publish the tables the frontend subscribes to ──────────────
alter publication supabase_realtime add table meeting_items;
alter publication supabase_realtime add table transcript_chunks;
alter publication supabase_realtime add table ids_insights;
alter publication supabase_realtime add table coach_messages;

-- ───────── RLS (single-tenant V1: permissive; tighten later) ────────────────────
alter table meetings enable row level security;
alter table meeting_items enable row level security;
alter table transcript_chunks enable row level security;
alter table coach_messages enable row level security;
alter table ids_insights enable row level security;
alter table playbooks enable row level security;
alter table playbook_sections enable row level security;
alter table playbook_examples enable row level security;
alter table meeting_cost_events enable row level security;
alter table manual_edit_diffs enable row level security;

-- Permissive read for anon + authenticated; writes only via service role from the server.
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'meetings','meeting_items','transcript_chunks','coach_messages','ids_insights',
      'playbooks','playbook_sections','playbook_examples','meeting_cost_events','manual_edit_diffs'
    ])
  loop
    execute format('drop policy if exists "read all" on %I;', t);
    execute format('create policy "read all" on %I for select using (true);', t);
  end loop;
end $$;

-- ───────── Retention: drop transcript chunks older than 90 days ─────────────────
create or replace function purge_old_transcript_chunks() returns void language sql as $$
  delete from transcript_chunks where received_at < now() - interval '90 days';
$$;
-- To enable nightly purge, set up a Supabase cron job (Database → Cron) pointing at this fn.
