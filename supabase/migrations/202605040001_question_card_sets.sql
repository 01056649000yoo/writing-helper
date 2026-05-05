create table if not exists writing_helper.question_card_sets (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  description text not null default '',
  prompts jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists question_card_sets_teacher_id_sort_order_idx
  on writing_helper.question_card_sets(teacher_id, sort_order, created_at);
