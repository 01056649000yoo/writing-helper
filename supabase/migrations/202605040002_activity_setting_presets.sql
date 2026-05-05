create table if not exists writing_helper.activity_setting_presets (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null,
  title text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activity_setting_presets_teacher_activity_idx
  on writing_helper.activity_setting_presets(teacher_id, activity_type, created_at desc);
