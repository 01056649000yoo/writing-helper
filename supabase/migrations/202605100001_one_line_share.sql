create table if not exists writing_helper.one_line_entries (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references writing_helper.rooms(id) on delete cascade,
  session_id uuid not null references writing_helper.student_sessions(id) on delete cascade,
  student_number integer not null,
  student_name text not null,
  content text not null,
  contains_keywords boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, session_id)
);

create table if not exists writing_helper.one_line_reactions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references writing_helper.rooms(id) on delete cascade,
  entry_id uuid not null references writing_helper.one_line_entries(id) on delete cascade,
  session_id uuid not null references writing_helper.student_sessions(id) on delete cascade,
  reaction_type text not null default 'like',
  created_at timestamptz not null default now(),
  unique (entry_id, session_id, reaction_type)
);

create index if not exists one_line_entries_room_id_created_at_idx
  on writing_helper.one_line_entries(room_id, created_at);

create index if not exists one_line_entries_session_id_idx
  on writing_helper.one_line_entries(session_id);

create index if not exists one_line_reactions_room_id_created_at_idx
  on writing_helper.one_line_reactions(room_id, created_at);

create index if not exists one_line_reactions_entry_id_idx
  on writing_helper.one_line_reactions(entry_id);

grant all on writing_helper.one_line_entries to service_role;
grant all on writing_helper.one_line_reactions to service_role;
