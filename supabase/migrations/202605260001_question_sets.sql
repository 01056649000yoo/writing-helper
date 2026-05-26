-- =====================================================
-- 교사별 질문 세트 (커스텀 큐레이션)
-- =====================================================
-- 교사가 기본 카드 묶음의 질문들에서 골라 직접 큐레이션한
-- 1개의 평면 질문 풀. 활동 만들 때 묶음 대신 이 세트를 선택할
-- 수 있다.
--
-- items 형식:
--   [{"text": "...", "source_label": "관점"}, ...]
-- source_label은 어느 묶음에서 가져왔는지 추적용 (없어도 됨)

CREATE TABLE writing_helper.question_sets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  items       jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX question_sets_teacher_id_idx
  ON writing_helper.question_sets(teacher_id, sort_order, created_at);

CREATE OR REPLACE FUNCTION writing_helper.set_question_sets_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_question_sets_updated_at
  BEFORE UPDATE ON writing_helper.question_sets
  FOR EACH ROW EXECUTE FUNCTION writing_helper.set_question_sets_updated_at();

ALTER TABLE writing_helper.question_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher owns question_set"
  ON writing_helper.question_sets FOR ALL
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);
