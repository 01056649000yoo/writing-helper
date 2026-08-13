alter table writing_helper.hanja_writing_reactions
  add column if not exists target_sentence_index integer;

update writing_helper.hanja_writing_reactions
set target_sentence_index = 0
where target_sentence_index is null;

alter table writing_helper.hanja_writing_reactions
  alter column target_sentence_index set not null;

alter table writing_helper.hanja_writing_reactions
  drop constraint if exists hanja_writing_reactions_target_sentence_index_check;

alter table writing_helper.hanja_writing_reactions
  add constraint hanja_writing_reactions_target_sentence_index_check
  check (target_sentence_index >= 0);

alter table writing_helper.hanja_writing_reactions
  drop constraint if exists hanja_writing_reactions_target_session_id_session_id_reaction_type_key;

alter table writing_helper.hanja_writing_reactions
  drop constraint if exists hanja_writing_reactions_sentence_like_unique;

alter table writing_helper.hanja_writing_reactions
  add constraint hanja_writing_reactions_sentence_like_unique
  unique (target_session_id, target_sentence_index, session_id, reaction_type);

create index if not exists hanja_writing_reactions_target_sentence_idx
  on writing_helper.hanja_writing_reactions(target_session_id, target_sentence_index);
