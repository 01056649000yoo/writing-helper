alter table writing_helper.teacher_profiles
  add column if not exists use_shared_api_key boolean not null default true;

create table if not exists writing_helper.service_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists service_audit_logs_created_at_idx
  on writing_helper.service_audit_logs(created_at desc);

create index if not exists service_audit_logs_action_created_at_idx
  on writing_helper.service_audit_logs(action, created_at desc);

create table if not exists writing_helper.api_usage_logs (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  model text,
  request_count integer not null default 1,
  used_shared_api boolean not null default true,
  room_id uuid references writing_helper.rooms(id) on delete set null,
  session_id uuid references writing_helper.student_sessions(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists api_usage_logs_teacher_id_created_at_idx
  on writing_helper.api_usage_logs(teacher_id, created_at desc);

create index if not exists api_usage_logs_feature_created_at_idx
  on writing_helper.api_usage_logs(feature, created_at desc);
