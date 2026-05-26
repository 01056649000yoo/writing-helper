create table if not exists writing_helper.question_card_roles (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  subtitle text not null default '',
  description text not null default '',
  icon text not null default '🃏',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table writing_helper.question_card_roles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'writing_helper'
      and tablename = 'question_card_roles'
      and policyname = 'Teachers manage their own question card roles'
  ) then
    create policy "Teachers manage their own question card roles"
      on writing_helper.question_card_roles
      for all
      using (auth.uid() = teacher_id)
      with check (auth.uid() = teacher_id);
  end if;
end $$;

alter table writing_helper.question_card_sets
  add column if not exists role_id uuid references writing_helper.question_card_roles(id) on delete set null;

create index if not exists question_card_roles_teacher_sort_idx
  on writing_helper.question_card_roles (teacher_id, sort_order, created_at);

create index if not exists question_card_sets_role_id_idx
  on writing_helper.question_card_sets (role_id);

grant usage on schema writing_helper to anon, authenticated, service_role;
grant select, insert, update, delete on writing_helper.question_card_roles to authenticated, service_role;
grant select on writing_helper.question_card_roles to anon;
