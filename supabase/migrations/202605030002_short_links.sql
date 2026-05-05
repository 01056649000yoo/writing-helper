create table if not exists writing_helper.short_links (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references writing_helper.rooms(id) on delete cascade,
  code text not null unique,
  target_path text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists short_links_code_idx
  on writing_helper.short_links(code);
