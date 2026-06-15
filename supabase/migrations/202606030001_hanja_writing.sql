-- =====================================================
-- 한자 활용 문장 만들기 - 한자 카드 캐시
-- =====================================================
-- 단어별로 GPT가 생성한 한자/관련어 정보를 캐시한다.
-- (word, grade) 단위로 unique, 한 번 생성하면 모든 교사가 재활용.
--
-- hanja_data 형식:
--   {
--     "hanja": [{"char":"家","reading":"가","meaning":"집"}, ...],
--     "relatedWords": [{"word":"가정","hanja":"家庭","meaning":"...","sharedChar":"家"}, ...],
--     "definition": "...",
--     "example": "...",
--     "category": "가족과 이웃"
--   }

CREATE TABLE writing_helper.hanja_word_cards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word         text NOT NULL,
  grade        integer NOT NULL CHECK (grade BETWEEN 3 AND 6),
  hanja_data   jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (word, grade)
);

CREATE INDEX hanja_word_cards_grade_idx
  ON writing_helper.hanja_word_cards(grade, word);

ALTER TABLE writing_helper.hanja_word_cards ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자가 읽을 수 있는 공용 캐시.
-- 쓰기는 service_role(admin)만 가능.
CREATE POLICY "authenticated can read hanja cards"
  ON writing_helper.hanja_word_cards FOR SELECT
  TO authenticated
  USING (true);
