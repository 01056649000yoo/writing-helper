create table if not exists writing_helper.service_settings (
  id text primary key default 'singleton',
  admin_email text,
  global_vault_secret_id uuid references writing_helper.api_secrets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into writing_helper.service_settings (id)
values ('singleton')
on conflict (id) do nothing;
