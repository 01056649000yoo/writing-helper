-- =====================================================
-- 과학 관찰·추론 글쓰기 활동
-- =====================================================

-- 교사가 만드는 과학 활동 방
CREATE TABLE writing_helper.science_rooms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id      uuid REFERENCES writing_helper.classes(id) ON DELETE SET NULL,

  -- 기본 정보
  title         text NOT NULL,
  topic         text NOT NULL DEFAULT '',        -- 실험·관찰 주제
  instructions  text NOT NULL DEFAULT '',        -- 학생에게 보이는 안내문

  -- 1단계(관찰) 설정
  use_before_after    boolean NOT NULL DEFAULT true,   -- 변화 전·후 카드
  enabled_senses      text[]  NOT NULL DEFAULT '{"sight","smell","hearing","touch"}',
  enabled_measurements text[] NOT NULL DEFAULT '{}',   -- cm / g / °C / s / custom
  custom_measurement_label text NOT NULL DEFAULT '',
  use_drawing         boolean NOT NULL DEFAULT true,

  -- 2단계(추론) 설정
  use_inference_template  boolean NOT NULL DEFAULT true,
  use_counter_argument    boolean NOT NULL DEFAULT false,

  -- 3단계(질문) 설정
  enabled_variable_cards  text[] NOT NULL DEFAULT '{"temperature","amount","material","time"}',

  -- 완성 후 설정
  use_peer_review  boolean NOT NULL DEFAULT true,
  use_ai_summary   boolean NOT NULL DEFAULT false,

  is_active   boolean NOT NULL DEFAULT true,
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 학생 세션 (단계별 진행 저장)
CREATE TABLE writing_helper.science_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        uuid NOT NULL REFERENCES writing_helper.science_rooms(id) ON DELETE CASCADE,
  student_number integer NOT NULL,
  student_name   text    NOT NULL,

  -- 1단계: 관찰
  before_state   text    NOT NULL DEFAULT '',   -- 변하기 전
  after_state    text    NOT NULL DEFAULT '',   -- 변한 후
  sense_tags     jsonb   NOT NULL DEFAULT '[]', -- [{ sense: "sight", text: "..." }]
  measurements   jsonb   NOT NULL DEFAULT '[]', -- [{ label: "온도", value: "45", unit: "°C" }]
  drawing_data   text    NOT NULL DEFAULT '',   -- base64 PNG

  -- 2단계: 추론
  inference_text    text NOT NULL DEFAULT '',
  counter_text      text NOT NULL DEFAULT '',   -- 반대 생각

  -- 3단계: 질문
  question_type  text NOT NULL DEFAULT '',      -- temperature / amount / material / time
  question_text  text NOT NULL DEFAULT '',

  -- AI 정리 결과 (선택)
  ai_summary     text NOT NULL DEFAULT '',

  current_step   smallint NOT NULL DEFAULT 1,   -- 1 / 2 / 3 / 4(완료)
  status         text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'done')),

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 동료 리뷰 반응
CREATE TABLE writing_helper.science_reviews (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             uuid NOT NULL REFERENCES writing_helper.science_rooms(id) ON DELETE CASCADE,
  reviewer_session_id uuid NOT NULL REFERENCES writing_helper.science_sessions(id) ON DELETE CASCADE,
  target_session_id   uuid NOT NULL REFERENCES writing_helper.science_sessions(id) ON DELETE CASCADE,
  reaction            text NOT NULL CHECK (reaction IN ('agree', 'differ', 'discovery')),
  created_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (reviewer_session_id, target_session_id, reaction)
);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION writing_helper.set_science_session_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_science_sessions_updated_at
  BEFORE UPDATE ON writing_helper.science_sessions
  FOR EACH ROW EXECUTE FUNCTION writing_helper.set_science_session_updated_at();

-- RLS
ALTER TABLE writing_helper.science_rooms    ENABLE ROW LEVEL SECURITY;
ALTER TABLE writing_helper.science_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE writing_helper.science_reviews  ENABLE ROW LEVEL SECURITY;

-- science_rooms: 교사 본인만 관리, 학생은 is_active인 방만 읽기
CREATE POLICY "teacher owns science_room"
  ON writing_helper.science_rooms FOR ALL
  USING (teacher_id = auth.uid());

CREATE POLICY "student reads active science_room"
  ON writing_helper.science_rooms FOR SELECT
  USING (is_active = true);

-- science_sessions: 공개 읽기, 본인 세션만 쓰기 (anon 허용 — 학생은 비로그인)
CREATE POLICY "anyone reads science_sessions"
  ON writing_helper.science_sessions FOR SELECT
  USING (true);

CREATE POLICY "anyone inserts science_sessions"
  ON writing_helper.science_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "anyone updates own science_session"
  ON writing_helper.science_sessions FOR UPDATE
  USING (true);

-- science_reviews: 공개 읽기·쓰기
CREATE POLICY "anyone reads science_reviews"
  ON writing_helper.science_reviews FOR SELECT
  USING (true);

CREATE POLICY "anyone inserts science_reviews"
  ON writing_helper.science_reviews FOR INSERT
  WITH CHECK (true);

CREATE POLICY "anyone deletes own science_review"
  ON writing_helper.science_reviews FOR DELETE
  USING (true);

-- 권한 부여 (새 테이블은 ALL ON ALL TABLES 소급 적용 안 됨)
GRANT ALL ON writing_helper.science_rooms    TO service_role;
GRANT ALL ON writing_helper.science_sessions TO service_role;
GRANT ALL ON writing_helper.science_reviews  TO service_role;

GRANT ALL ON writing_helper.science_rooms    TO authenticated;
GRANT ALL ON writing_helper.science_sessions TO authenticated;
GRANT ALL ON writing_helper.science_reviews  TO authenticated;

GRANT SELECT                 ON writing_helper.science_rooms    TO anon;
GRANT SELECT, INSERT, UPDATE ON writing_helper.science_sessions TO anon;
GRANT SELECT, INSERT, DELETE ON writing_helper.science_reviews  TO anon;
