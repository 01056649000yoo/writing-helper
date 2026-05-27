-- Resolve Supabase linter `rls_disabled_in_public` errors.
-- 1) Drop orphan public.documents / public.document_chunks (no code references).
-- 2) Enable RLS + ownership policy on writing_helper.question_card_sets.

drop table if exists public.document_chunks cascade;
drop table if exists public.documents cascade;

alter table writing_helper.question_card_sets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'writing_helper'
      and tablename = 'question_card_sets'
      and policyname = 'Teachers manage their own question card sets'
  ) then
    create policy "Teachers manage their own question card sets"
      on writing_helper.question_card_sets
      for all
      using (auth.uid() = teacher_id)
      with check (auth.uid() = teacher_id);
  end if;
end $$;
