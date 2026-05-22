-- =====================================================
-- 과학 글쓰기 활동: 기초탐구·통합탐구 트랙 시스템 도입
-- =====================================================
-- 기존 컬럼은 legacy 호환용으로 유지하고, 신규 트랙·스킬 시스템을
-- 위한 컬럼을 추가한다. 기존 방은 inquiry_track=NULL 으로 두어
-- 학생 화면에서 legacy 3단계(관찰/추론/질문) 흐름으로 처리한다.

ALTER TABLE writing_helper.science_rooms
  ADD COLUMN IF NOT EXISTS inquiry_track text
    CHECK (inquiry_track IS NULL OR inquiry_track IN ('basic', 'integrated')),
  ADD COLUMN IF NOT EXISTS enabled_skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS skill_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE writing_helper.science_sessions
  ADD COLUMN IF NOT EXISTS skill_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS completed_skills text[] NOT NULL DEFAULT '{}';
