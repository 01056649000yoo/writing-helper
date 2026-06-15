create table if not exists writing_helper.hanja_writing_reactions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references writing_helper.rooms(id) on delete cascade,
  target_session_id uuid not null references writing_helper.student_sessions(id) on delete cascade,
  session_id uuid not null references writing_helper.student_sessions(id) on delete cascade,
  reaction_type text not null default 'like',
  created_at timestamptz not null default now(),
  unique (target_session_id, session_id, reaction_type)
);

create index if not exists hanja_writing_reactions_room_id_created_at_idx
  on writing_helper.hanja_writing_reactions(room_id, created_at);

create index if not exists hanja_writing_reactions_target_session_idx
  on writing_helper.hanja_writing_reactions(target_session_id);

grant all on writing_helper.hanja_writing_reactions to service_role;
