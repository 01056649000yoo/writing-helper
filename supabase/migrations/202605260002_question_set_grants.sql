-- Ensure newer question set tables are accessible through PostgREST roles.

GRANT ALL ON writing_helper.question_card_sets TO service_role;
GRANT ALL ON writing_helper.question_sets TO service_role;

GRANT ALL ON writing_helper.question_card_sets TO authenticated;
GRANT ALL ON writing_helper.question_sets TO authenticated;
