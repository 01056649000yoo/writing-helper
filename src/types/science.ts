// =====================================================
// 과학 관찰·추론 글쓰기 활동 타입
// =====================================================

export type SenseType = "sight" | "smell" | "hearing" | "touch";
export type VariableCardType = "temperature" | "amount" | "material" | "time";
export type QuestionType = "variable" | "principle" | "extend";
export type ScienceReaction = "agree" | "differ" | "discovery";
export type ScienceStep = 1 | 2 | 3 | 4; // 4 = 완료

// ------- 교사 설정 -------

export interface ScienceRoomConfig {
  // 1단계(관찰)
  useBeforeAfter: boolean;
  enabledSenses: SenseType[];
  enabledMeasurements: MeasurementUnit[];
  customMeasurementLabel: string;
  useDrawing: boolean;
  // 2단계(추론)
  useInferenceTemplate: boolean;
  useCounterArgument: boolean;
  // 3단계(질문)
  enabledVariableCards: VariableCardType[];
  // 완성 후
  usePeerReview: boolean;
  useAiSummary: boolean;
}

export interface MeasurementUnit {
  label: string;   // 예: "온도"
  unit: string;    // 예: "°C"
}

export const PRESET_MEASUREMENTS: MeasurementUnit[] = [
  { label: "길이", unit: "cm" },
  { label: "무게", unit: "g" },
  { label: "온도", unit: "°C" },
  { label: "시간", unit: "초" },
];

export const VARIABLE_CARD_META: Record<VariableCardType, { emoji: string; label: string; placeholder: string }> = {
  temperature: { emoji: "🌡", label: "온도를 바꾼다면?",   placeholder: "온도를 높이면 어떻게 될까요?" },
  amount:      { emoji: "⚖️", label: "양을 바꾼다면?",    placeholder: "양을 반으로 줄이면 어떻게 될까요?" },
  material:    { emoji: "🧱", label: "재질을 바꾼다면?",   placeholder: "유리 대신 플라스틱이면 어떻게 될까요?" },
  time:        { emoji: "⏱", label: "시간을 바꾼다면?",   placeholder: "더 오래 두면 어떻게 될까요?" },
};

export const SENSE_META: Record<SenseType, { emoji: string; label: string }> = {
  sight:   { emoji: "👁", label: "눈으로 봤어요" },
  smell:   { emoji: "👃", label: "냄새가 났어요" },
  hearing: { emoji: "👂", label: "소리가 들렸어요" },
  touch:   { emoji: "🖐", label: "손으로 느꼈어요" },
};

export const SENSE_HINT_CARDS: Record<SenseType, string[]> = {
  sight:   ["색이 변했어요", "기포가 생겼어요", "모양이 바뀌었어요", "녹았어요", "굳었어요"],
  smell:   ["냄새가 났어요", "냄새가 강해졌어요", "냄새가 없어졌어요"],
  hearing: ["소리가 났어요", "소리가 커졌어요", "조용해졌어요"],
  touch:   ["뜨거워졌어요", "차가워졌어요", "딱딱해졌어요", "부드러워졌어요"],
};

// ------- 교사 방 -------

export interface ScienceRoom {
  id: string;
  teacher_id: string;
  class_id: string | null;
  title: string;
  topic: string;
  instructions: string;
  // config (DB의 개별 컬럼을 합쳐서 사용)
  config: ScienceRoomConfig;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

// ------- 학생 세션 -------

export interface SenseTag {
  sense: SenseType;
  text: string;
}

export interface MeasurementEntry {
  label: string;
  value: string;
  unit: string;
}

export interface ScienceSession {
  id: string;
  room_id: string;
  student_number: number;
  student_name: string;
  // 1단계
  before_state: string;
  after_state: string;
  sense_tags: SenseTag[];
  measurements: MeasurementEntry[];
  drawing_data: string;       // base64 PNG
  // 2단계
  inference_text: string;
  counter_text: string;
  // 3단계
  question_type: VariableCardType | QuestionType | "";
  question_text: string;
  // 완성
  ai_summary: string;
  current_step: ScienceStep;
  status: "in_progress" | "done";
  created_at: string;
  updated_at: string;
}

// ------- 동료 리뷰 -------

export interface ScienceReview {
  id: string;
  room_id: string;
  reviewer_session_id: string;
  target_session_id: string;
  reaction: ScienceReaction;
  created_at: string;
}

export const REACTION_META: Record<ScienceReaction, { emoji: string; label: string; color: string }> = {
  agree:     { emoji: "👀", label: "나도 봤어!",     color: "bg-indigo-50 text-indigo-600" },
  differ:    { emoji: "🤔", label: "나는 달랐는데",  color: "bg-amber-50 text-amber-600" },
  discovery: { emoji: "💡", label: "이건 몰랐어",    color: "bg-emerald-50 text-emerald-600" },
};

// ------- 교사 모니터링용 집계 -------

export interface ScienceSessionSummary {
  session: ScienceSession;
  reactions: Record<ScienceReaction, number>;
}
