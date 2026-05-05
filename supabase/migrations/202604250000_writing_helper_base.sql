create schema if not exists writing_helper;

create table if not exists writing_helper.api_secrets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists writing_helper.teacher_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  vault_secret_id uuid references writing_helper.api_secrets(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists writing_helper.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  grade_level text not null,
  created_at timestamptz not null default now()
);

create table if not exists writing_helper.class_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references writing_helper.classes(id) on delete cascade,
  student_number integer not null,
  student_name text not null,
  created_at timestamptz not null default now(),
  unique (class_id, student_number)
);

create table if not exists writing_helper.rooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid references writing_helper.classes(id) on delete set null,
  title text not null,
  topic text not null,
  topic_description text not null default '',
  subject_type text not null,
  grade_level text not null,
  outline_depth text not null default 'simple',
  is_active boolean not null default true,
  question_sets jsonb,
  questions_generated_at timestamptz,
  max_calls_per_student integer not null default 3,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists writing_helper.room_students (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references writing_helper.rooms(id) on delete cascade,
  student_number integer not null,
  student_name text not null,
  created_at timestamptz not null default now(),
  unique (room_id, student_number)
);

create table if not exists writing_helper.student_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references writing_helper.rooms(id) on delete cascade,
  room_student_id uuid references writing_helper.room_students(id) on delete set null,
  student_number integer not null,
  student_name text not null,
  level text,
  answers jsonb not null default '[]'::jsonb,
  status text not null default 'in_progress',
  gpt_call_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, student_number, student_name)
);

create table if not exists writing_helper.outline_queue (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references writing_helper.student_sessions(id) on delete cascade,
  room_id uuid not null references writing_helper.rooms(id) on delete cascade,
  status text not null default 'waiting',
  answers jsonb not null default '[]'::jsonb,
  result text,
  position integer,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists classes_teacher_id_created_at_idx
  on writing_helper.classes(teacher_id, created_at desc);

create index if not exists class_students_class_id_number_idx
  on writing_helper.class_students(class_id, student_number);

create index if not exists rooms_teacher_id_created_at_idx
  on writing_helper.rooms(teacher_id, created_at desc);

create index if not exists rooms_class_id_created_at_idx
  on writing_helper.rooms(class_id, created_at desc);

create index if not exists student_sessions_room_id_created_at_idx
  on writing_helper.student_sessions(room_id, created_at);

create index if not exists outline_queue_status_created_at_idx
  on writing_helper.outline_queue(status, created_at);

create or replace function public.wh_vault_upsert_secret(p_secret text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = writing_helper, public
as $$
declare
  secret_id uuid;
begin
  insert into writing_helper.api_secrets(name, secret, updated_at)
  values (p_name, p_secret, now())
  on conflict (name) do update
    set secret = excluded.secret,
        updated_at = now()
  returning id into secret_id;

  return secret_id;
end;
$$;

create or replace function public.wh_vault_get_secret(p_id uuid)
returns text
language sql
security definer
set search_path = writing_helper, public
as $$
  select secret
  from writing_helper.api_secrets
  where id = p_id
  limit 1;
$$;

create or replace function public.wh_vault_has_secret(p_name text)
returns boolean
language sql
security definer
set search_path = writing_helper, public
as $$
  select exists (
    select 1
    from writing_helper.api_secrets
    where name = p_name
  );
$$;

grant usage on schema writing_helper to anon, authenticated, service_role;
grant all on all tables in schema writing_helper to service_role;
grant all on all sequences in schema writing_helper to service_role;
grant execute on function public.wh_vault_upsert_secret(text, text) to service_role;
grant execute on function public.wh_vault_get_secret(uuid) to service_role;
grant execute on function public.wh_vault_has_secret(text) to service_role;

