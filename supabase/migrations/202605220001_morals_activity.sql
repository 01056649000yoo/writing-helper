-- =====================================================
-- 도덕 가치 글쓰기 활동
-- =====================================================
-- 과학 활동(science_*)과 동일한 트랙·스킬 패턴.
-- 트랙: reflection (3·4학년) / judgement (5·6학년)

CREATE TABLE writing_helper.morals_rooms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id      uuid REFERENCES writing_helper.classes(id) ON DELETE SET NULL,

  title         text NOT NULL,
  topic         text NOT NULL DEFAULT '',          -- 활동 주제
  instructions  text NOT NULL DEFAULT '',          -- 학생 안내문

  track          text NOT NULL CHECK (track IN ('reflection', 'judgement')),
  enabled_skills text[] NOT NULL DEFAULT '{}',
  skill_settings jsonb  NOT NULL DEFAULT '{}'::jsonb,

  is_active   boolean NOT NULL DEFAULT true,
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE writing_helper.morals_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        uuid NOT NULL REFERENCES writing_helper.morals_rooms(id) ON DELETE CASCADE,
  student_number integer NOT NULL,
  student_name   text    NOT NULL,

  skill_data       jsonb  NOT NULL DEFAULT '{}'::jsonb,
  completed_skills text[] NOT NULL DEFAULT '{}',

  status      text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'done')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE writing_helper.morals_reactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             uuid NOT NULL REFERENCES writing_helper.morals_rooms(id) ON DELETE CASCADE,
  reviewer_session_id uuid NOT NULL REFERENCES writing_helper.morals_sessions(id) ON DELETE CASCADE,
  target_session_id   uuid NOT NULL REFERENCES writing_helper.morals_sessions(id) ON DELETE CASCADE,
  reaction            text NOT NULL CHECK (reaction IN ('empathy', 'reflect', 'respect')),
  created_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (reviewer_session_id, target_session_id, reaction)
);

CREATE OR REPLACE FUNCTION writing_helper.set_morals_session_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_morals_sessions_updated_at
  BEFORE UPDATE ON writing_helper.morals_sessions
  FOR EACH ROW EXECUTE FUNCTION writing_helper.set_morals_session_updated_at();

ALTER TABLE writing_helper.morals_rooms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE writing_helper.morals_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE writing_helper.morals_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher owns morals_room"
  ON writing_helper.morals_rooms FOR ALL
  USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "student reads active morals_room"
  ON writing_helper.morals_rooms FOR SELECT
  USING (is_active = true);

CREATE POLICY "anyone reads morals_sessions"
  ON writing_helper.morals_sessions FOR SELECT USING (true);

CREATE POLICY "anyone inserts morals_sessions"
  ON writing_helper.morals_sessions FOR INSERT WITH CHECK (true);

CREATE POLICY "anyone updates own morals_session"
  ON writing_helper.morals_sessions FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "anyone reads morals_reactions"
  ON writing_helper.morals_reactions FOR SELECT USING (true);

CREATE POLICY "anyone inserts morals_reactions"
  ON writing_helper.morals_reactions FOR INSERT WITH CHECK (true);

CREATE POLICY "anyone deletes own morals_reaction"
  ON writing_helper.morals_reactions FOR DELETE USING (true);

CREATE INDEX morals_rooms_class_id_created_at_idx ON writing_helper.morals_rooms(class_id, created_at DESC);
CREATE INDEX morals_rooms_teacher_id_created_at_idx ON writing_helper.morals_rooms(teacher_id, created_at DESC);
CREATE INDEX morals_sessions_room_id_idx ON writing_helper.morals_sessions(room_id, created_at);
