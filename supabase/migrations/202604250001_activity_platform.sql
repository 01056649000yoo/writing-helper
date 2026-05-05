-- Activity platform foundation.
-- This migration preserves existing outline-builder columns and adds a generic
-- activity layer that new classroom formats can use.

alter table writing_helper.rooms
  add column if not exists activity_type text not null default 'outline_builder',
  add column if not exists activity_config jsonb not null default '{}'::jsonb,
  add column if not exists activity_state jsonb not null default '{}'::jsonb;

alter table writing_helper.student_sessions
  add column if not exists progress_step text,
  add column if not exists progress_index integer,
  add column if not exists activity_state jsonb not null default '{}'::jsonb,
  add column if not exists submission jsonb not null default '{}'::jsonb,
  add column if not exists result jsonb not null default '{}'::jsonb;

create table if not exists writing_helper.activity_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references writing_helper.rooms(id) on delete cascade,
  session_id uuid references writing_helper.student_sessions(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_room_id_created_at_idx
  on writing_helper.activity_events(room_id, created_at);

create index if not exists activity_events_session_id_idx
  on writing_helper.activity_events(session_id);

create index if not exists rooms_activity_type_idx
  on writing_helper.rooms(activity_type);

update writing_helper.rooms
set
  activity_type = coalesce(nullif(activity_type, ''), 'outline_builder'),
  activity_config = case
    when activity_config = '{}'::jsonb then jsonb_strip_nulls(jsonb_build_object(
      'subjectType', subject_type,
      'gradeLevel', grade_level,
      'outlineDepth', outline_depth,
      'questionSets', question_sets,
      'questionsGeneratedAt', questions_generated_at
    ))
    else activity_config
  end
where activity_type = 'outline_builder'
  and (
    activity_config = '{}'::jsonb
    or activity_config is null
  );

