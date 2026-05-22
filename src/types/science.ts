// =====================================================
// 과학 탐구 글쓰기 활동 타입
// =====================================================

export type SenseType = "sight" | "smell" | "hearing" | "touch";
export type VariableCardType =
  | "temperature"   // 온도
  | "amount"        // 양
  | "material"      // 재질
  | "time"          // 시간
  | "light"         // 빛
  | "length"        // 길이·크기
  | "concentration" // 농도
  | "shape"         // 모양
  | "distance"      // 거리
  | "weight"        // 무게
  | "water";        // 물
export type QuestionType = "variable" | "principle" | "extend";
export type ScienceReaction = "agree" | "differ" | "discovery";
export type ScienceStep = 1 | 2 | 3 | 4; // 4 = 완료 (legacy)

// =====================================================
// 신규: 탐구 과정 트랙 + 스킬 시스템
// =====================================================

export type InquiryTrack = "basic" | "integrated";

/** 기초탐구 (3-4학년) */
export type BasicSkillKey =
  | "observation"     // 관찰
  | "classification"  // 분류
  | "measurement"     // 측정
  | "prediction"      // 예상
  | "inference"       // 추리
  | "communication";  // 의사소통

/** 통합탐구 (5-6학년) */
export type IntegratedSkillKey =
  | "problem"          // 문제 인식
  | "hypothesis"       // 가설 설정
  | "variable_control" // 변인 통제
  | "data_transform"   // 자료 변환
  | "data_interpret"   // 자료 해석
  | "conclusion";      // 결론 도출

export type SkillKey = BasicSkillKey | IntegratedSkillKey;

export const TRACK_META: Record<InquiryTrack, {
  emoji: string;
  label: string;
  gradeBand: string;
  summary: string;
  skills: readonly SkillKey[];
}> = {
  basic: {
    emoji: "🌱",
    label: "기초탐구과정",
    gradeBand: "3·4학년",
    summary: "감각으로 관찰하고 분류·측정하며 예상·추리·의사소통하는 과학 글쓰기",
    skills: ["observation", "classification", "measurement", "prediction", "inference", "communication"] as const,
  },
  integrated: {
    emoji: "🔬",
    label: "통합탐구과정",
    gradeBand: "5·6학년",
    summary: "문제를 인식하고 가설·변인을 통제하며 자료를 해석해 결론을 도출하는 과학 글쓰기",
    skills: ["problem", "hypothesis", "variable_control", "data_transform", "data_interpret", "conclusion"] as const,
  },
};

export const SKILL_META: Record<SkillKey, {
  track: InquiryTrack;
  emoji: string;
  label: string;
  description: string;
  studentHeading: string;
}> = {
  // ── 기초탐구 ──
  observation: {
    track: "basic",
    emoji: "👀",
    label: "관찰",
    description: "오감을 활용해 대상의 모양·색·소리·냄새·촉감을 자세히 살펴봅니다.",
    studentHeading: "🔍 잘 보고 적어요",
  },
  classification: {
    track: "basic",
    emoji: "🗂️",
    label: "분류",
    description: "공통점·차이점을 찾아 일정한 기준으로 무리지어 정리합니다.",
    studentHeading: "🗂️ 기준에 맞게 나눠요",
  },
  measurement: {
    track: "basic",
    emoji: "📏",
    label: "측정",
    description: "도구를 사용해 길이·무게·온도·시간 같은 양을 정확히 잽니다.",
    studentHeading: "📏 정확하게 재요",
  },
  prediction: {
    track: "basic",
    emoji: "🔮",
    label: "예상",
    description: "지금까지 관찰·경험한 것을 바탕으로 앞으로 일어날 일을 미리 추측합니다.",
    studentHeading: "🔮 어떻게 될지 예상해요",
  },
  inference: {
    track: "basic",
    emoji: "💡",
    label: "추리",
    description: "관찰 결과로부터 보이지 않는 까닭을 짐작하고 이유를 댑니다.",
    studentHeading: "💡 왜 그럴지 추리해요",
  },
  communication: {
    track: "basic",
    emoji: "📢",
    label: "의사소통",
    description: "관찰·추리 결과를 친구가 이해하기 쉽게 정리해 나눕니다.",
    studentHeading: "📢 친구에게 잘 전해요",
  },

  // ── 통합탐구 ──
  problem: {
    track: "integrated",
    emoji: "❓",
    label: "문제 인식",
    description: "관찰한 현상에서 탐구할 만한 문제를 분명하게 다듬어 정의합니다.",
    studentHeading: "❓ 탐구할 문제를 정해요",
  },
  hypothesis: {
    track: "integrated",
    emoji: "🧠",
    label: "가설 설정",
    description: "문제에 대한 잠정적 답(가설)을 '만약~한다면~' 형식으로 만들어 봅니다.",
    studentHeading: "🧠 가설을 세워요",
  },
  variable_control: {
    track: "integrated",
    emoji: "🎛️",
    label: "변인 통제",
    description: "조작 변인·통제 변인·종속 변인을 구분하고 실험 조건을 설계합니다.",
    studentHeading: "🎛️ 변인을 정리해요",
  },
  data_transform: {
    track: "integrated",
    emoji: "📊",
    label: "자료 변환",
    description: "관찰·측정한 자료를 표나 그래프 같은 다른 형식으로 바꿔 나타냅니다.",
    studentHeading: "📊 자료를 표·그래프로 바꿔요",
  },
  data_interpret: {
    track: "integrated",
    emoji: "🔎",
    label: "자료 해석",
    description: "표·그래프에서 규칙성·경향성을 찾아 그 의미를 글로 풀어냅니다.",
    studentHeading: "🔎 자료에서 규칙을 찾아요",
  },
  conclusion: {
    track: "integrated",
    emoji: "🏁",
    label: "결론 도출",
    description: "가설과 결과를 비교해 결론을 내리고, 가능한 경우 일반화·후속 탐구를 적습니다.",
    studentHeading: "🏁 결론을 내려요",
  },
};

// =====================================================
// 스킬별 세부 설정 — 교사가 활동마다 켜는 옵션
// =====================================================

export interface ObservationSettings {
  enabledSenses: SenseType[];        // 활성화할 감각 카드
  useBeforeAfter: boolean;           // 변하기 전·후 카드
  useDrawing: boolean;               // 그림 그리기
}

export interface ClassificationSettings {
  criteria: string[];                // 분류 기준 (예: "색", "모양", "크기")
  allowMultiLevel: boolean;          // 다단 분류 허용
}

export interface MeasurementSettings {
  enabledMeasurements: MeasurementUnit[]; // 측정 항목 + 단위
  repeatCount: number;               // 반복 측정 횟수 (1~5)
}

export interface PredictionSettings {
  useReasoningPrompt: boolean;       // "왜 그렇게 예상했나요?" 필수 입력
  useTemplate: boolean;              // "나는 ~ 라고 예상한다" 템플릿
}

export interface InferenceSettings {
  useTemplate: boolean;              // "나는 ~ 때문에 ~ 라고 생각합니다" 템플릿
  useCounterArgument: boolean;       // 반대 생각 카드
}

export interface CommunicationSettings {
  usePeerReview: boolean;            // 동료 리뷰
  useAiSummary: boolean;             // AI 글 정리
  useThreeLineSummary: boolean;      // 3줄 요약 카드
}

export interface ProblemSettings {
  useObservationLink: boolean;       // 관찰 → 문제로 변환하기 도움
  useTemplate: boolean;              // "왜 ~할까?" / "~인가?" 템플릿
}

export interface HypothesisSettings {
  useTemplate: boolean;              // "만약 ~ 한다면 ~ 일 것이다" 템플릿
  requireReasoning: boolean;         // 가설의 근거 입력 필수
}

export interface VariableControlSettings {
  enabledVariableCards: VariableCardType[]; // 조작/통제/종속 후보 카드
  useControlChecklist: boolean;      // 통제 변인 체크리스트
}

export type DataTransformShape = "table" | "bar_chart" | "line_chart";

export interface DataTransformSettings {
  enabledShapes: DataTransformShape[]; // 허용할 표·그래프 형식
  allowPhotoUpload: boolean;         // 사진 첨부 허용
}

export interface DataInterpretSettings {
  patternCards: string[];            // 패턴 카드 ("증가", "감소", "일정", "주기" 등)
  useTemplate: boolean;              // 해석 문장 템플릿
}

export interface ConclusionSettings {
  compareWithHypothesis: boolean;    // 가설과 비교 단계
  includeGeneralization: boolean;    // 일반화 문장 포함
  askFollowUp: boolean;              // 후속 탐구 질문 입력
}

export type SkillSettings = {
  observation?: ObservationSettings;
  classification?: ClassificationSettings;
  measurement?: MeasurementSettings;
  prediction?: PredictionSettings;
  inference?: InferenceSettings;
  communication?: CommunicationSettings;
  problem?: ProblemSettings;
  hypothesis?: HypothesisSettings;
  variable_control?: VariableControlSettings;
  data_transform?: DataTransformSettings;
  data_interpret?: DataInterpretSettings;
  conclusion?: ConclusionSettings;
};

export const DEFAULT_SKILL_SETTINGS: Required<SkillSettings> = {
  observation: {
    enabledSenses: ["sight", "smell", "hearing", "touch"],
    useBeforeAfter: true,
    useDrawing: true,
  },
  classification: {
    criteria: ["색", "모양", "크기"],
    allowMultiLevel: false,
  },
  measurement: {
    enabledMeasurements: [{ label: "길이", unit: "cm" }],
    repeatCount: 1,
  },
  prediction: {
    useReasoningPrompt: true,
    useTemplate: true,
  },
  inference: {
    useTemplate: true,
    useCounterArgument: false,
  },
  communication: {
    usePeerReview: true,
    useAiSummary: false,
    useThreeLineSummary: true,
  },
  problem: {
    useObservationLink: true,
    useTemplate: true,
  },
  hypothesis: {
    useTemplate: true,
    requireReasoning: true,
  },
  variable_control: {
    enabledVariableCards: ["temperature", "amount", "material", "time"],
    useControlChecklist: true,
  },
  data_transform: {
    enabledShapes: ["table", "bar_chart"],
    allowPhotoUpload: false,
  },
  data_interpret: {
    patternCards: ["증가", "감소", "일정", "주기"],
    useTemplate: true,
  },
  conclusion: {
    compareWithHypothesis: true,
    includeGeneralization: false,
    askFollowUp: true,
  },
};

// =====================================================
// 기존(legacy) 설정 — 이미 만들어진 활동 호환용
// =====================================================

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
  { label: "부피", unit: "mL" },
];

export const VARIABLE_CARD_META: Record<VariableCardType, { emoji: string; label: string; placeholder: string }> = {
  temperature:   { emoji: "🌡️", label: "온도를 바꾼다면?",    placeholder: "온도를 높이면 어떻게 달라질까요?" },
  amount:        { emoji: "⚖️",  label: "양을 바꾼다면?",      placeholder: "양을 반으로 줄이면 어떻게 달라질까요?" },
  material:      { emoji: "🧱",  label: "재질을 바꾼다면?",    placeholder: "유리 대신 플라스틱을 쓰면 어떻게 달라질까요?" },
  time:          { emoji: "⏱️",  label: "시간을 바꾼다면?",    placeholder: "더 오래 두면 어떻게 달라질까요?" },
  light:         { emoji: "☀️",  label: "빛을 바꾼다면?",      placeholder: "빛을 완전히 차단하면 어떻게 달라질까요?" },
  length:        { emoji: "📏",  label: "길이·크기를 바꾼다면?", placeholder: "길이를 두 배로 늘리면 어떻게 달라질까요?" },
  concentration: { emoji: "🧪",  label: "농도를 바꾼다면?",    placeholder: "물의 양을 늘려 농도를 낮추면 어떻게 달라질까요?" },
  shape:         { emoji: "🔷",  label: "모양을 바꾼다면?",    placeholder: "모양을 다르게 바꾸면 어떻게 달라질까요?" },
  distance:      { emoji: "📐",  label: "거리를 바꾼다면?",    placeholder: "거리를 가깝게 하면 어떻게 달라질까요?" },
  weight:        { emoji: "🏋️",  label: "무게를 바꾼다면?",    placeholder: "더 무거운 것을 사용하면 어떻게 달라질까요?" },
  water:         { emoji: "💧",  label: "물을 바꾼다면?",      placeholder: "물의 양을 늘리거나 줄이면 어떻게 달라질까요?" },
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
  // 신규 트랙·스킬 시스템 — legacy 방은 inquiryTrack=null
  inquiryTrack: InquiryTrack | null;
  enabledSkills: SkillKey[];
  skillSettings: SkillSettings;
  // legacy config (기존 컬럼 기반)
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

/** 스킬별로 학생이 채운 데이터 — JSONB로 저장 */
export type SkillData = {
  observation?: {
    beforeState: string;
    afterState: string;
    senseTags: SenseTag[];
    drawingData: string;
  };
  classification?: {
    /** 기준별 그룹 — [{ basis: "색", groups: [{ name: "노란색", items: ["바나나", "병아리"] }] }] */
    groupings: Array<{
      basis: string;
      groups: Array<{ name: string; items: string[] }>;
    }>;
  };
  measurement?: {
    entries: Array<{ label: string; unit: string; values: string[] }>;
  };
  prediction?: {
    prediction: string;
    reasoning: string;
  };
  inference?: {
    inferenceText: string;
    counterText: string;
  };
  communication?: {
    summary: string;          // 3줄 요약 또는 자유 요약
    aiSummary: string;        // AI 정리 결과 (있을 때만)
  };
  problem?: {
    problemText: string;
  };
  hypothesis?: {
    hypothesisText: string;
    reasoning: string;
  };
  variable_control?: {
    manipulated: string;       // 조작 변인
    controlled: string[];      // 통제 변인
    dependent: string;         // 종속 변인
  };
  data_transform?: {
    shape: DataTransformShape;
    /** 표일 때: rows=[[col1, col2], [col1, col2]] */
    tableHeaders?: string[];
    tableRows?: string[][];
    /** 그래프일 때: label/value 쌍 */
    chartData?: Array<{ label: string; value: number }>;
    photoData?: string;        // base64
  };
  data_interpret?: {
    patterns: string[];        // 선택한 패턴 카드
    interpretation: string;    // 해석 문장
  };
  conclusion?: {
    conclusionText: string;
    generalization: string;
    followUp: string;
  };
};

export interface ScienceSession {
  id: string;
  room_id: string;
  student_number: number;
  student_name: string;
  // 신규: 스킬별 데이터
  skillData: SkillData;
  /** 학생이 완료한 스킬 (순서 유지) — 진행 표시·뒤로가기 제어용 */
  completedSkills: SkillKey[];
  // legacy 컬럼 (이전 방용)
  before_state: string;
  after_state: string;
  sense_tags: SenseTag[];
  measurements: MeasurementEntry[];
  drawing_data: string;
  inference_text: string;
  counter_text: string;
  question_type: VariableCardType | QuestionType | "";
  question_text: string;
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
