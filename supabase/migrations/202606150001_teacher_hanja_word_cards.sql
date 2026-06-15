create table if not exists writing_helper.teacher_hanja_word_cards (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  word text not null,
  grade integer not null check (grade between 3 and 6),
  card_data jsonb not null,
  source_room_id uuid references writing_helper.rooms(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, word, grade)
);

create index if not exists teacher_hanja_word_cards_teacher_idx
  on writing_helper.teacher_hanja_word_cards (teacher_id, updated_at desc, created_at desc);

alter table writing_helper.teacher_hanja_word_cards enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'writing_helper'
      and tablename = 'teacher_hanja_word_cards'
      and policyname = 'Teachers manage their own hanja word cards'
  ) then
    create policy "Teachers manage their own hanja word cards"
      on writing_helper.teacher_hanja_word_cards
      for all
      using (auth.uid() = teacher_id)
      with check (auth.uid() = teacher_id);
  end if;
end $$;

grant usage on schema writing_helper to anon, authenticated, service_role;
grant select, insert, update, delete on writing_helper.teacher_hanja_word_cards to authenticated, service_role;
