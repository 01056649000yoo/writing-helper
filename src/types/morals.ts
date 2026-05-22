// =====================================================
// 도덕 가치 글쓰기 활동 타입
// =====================================================
// 과학(types/science.ts)과 동일한 트랙·스킬 패턴.
// 트랙: 감정 성찰(3·4학년) / 가치 판단·실천(5·6학년)
// =====================================================

export type MoralsReaction = "empathy" | "reflect" | "respect";
export type MoralsTrack = "reflection" | "judgement";

/** 감정 성찰 트랙 (3·4학년) */
export type ReflectionSkillKey =
  | "situation"      // 상황 떠올리기
  | "emotion"        // 그때 내 마음 (감정 카드)
  | "value_find"     // 그 안에 담긴 가치
  | "perspective"    // 상대 입장 바꿔 보기
  | "resolution";    // 다음엔 어떻게 (다짐)

/** 가치 판단·실천 트랙 (5·6학년) */
export type JudgementSkillKey =
  | "dilemma"        // 가치 갈등 인식
  | "stakeholders"   // 입장별 분석
  | "principle"      // 도덕 원칙 적용
  | "consequence"    // 결과 예측
  | "action_plan"    // 실천 계획
  | "self_review";   // 사후 성찰

export type MoralsSkillKey = ReflectionSkillKey | JudgementSkillKey;

export const MORALS_TRACK_META: Record<MoralsTrack, {
  emoji: string;
  label: string;
  gradeBand: string;
  summary: string;
  skills: readonly MoralsSkillKey[];
}> = {
  reflection: {
    emoji: "🪞",
    label: "감정 성찰",
    gradeBand: "3·4학년",
    summary: "있었던 일과 그때의 감정을 떠올리고, 그 안에 담긴 가치와 다짐을 글로 쓰는 활동",
    skills: ["situation", "emotion", "value_find", "perspective", "resolution"] as const,
  },
  judgement: {
    emoji: "⚖️",
    label: "가치 판단·실천",
    gradeBand: "5·6학년",
    summary: "가치 갈등 상황을 여러 입장에서 분석하고, 도덕 원칙으로 판단해 실천 계획을 세우는 활동",
    skills: ["dilemma", "stakeholders", "principle", "consequence", "action_plan", "self_review"] as const,
  },
};

export const MORALS_SKILL_META: Record<MoralsSkillKey, {
  track: MoralsTrack;
  emoji: string;
  label: string;
  description: string;
  studentHeading: string;
}> = {
  // ── 감정 성찰 트랙 ──
  situation: {
    track: "reflection",
    emoji: "📅",
    label: "상황 떠올리기",
    description: "있었던 일을 시간·장소·등장인물 중심으로 구체적으로 떠올립니다.",
    studentHeading: "📅 그때 무슨 일이 있었나요?",
  },
  emotion: {
    track: "reflection",
    emoji: "💗",
    label: "그때 내 마음",
    description: "그 순간 느낀 감정을 정확한 어휘로 표현합니다.",
    studentHeading: "💗 그때 내 마음은 어땠나요?",
  },
  value_find: {
    track: "reflection",
    emoji: "✨",
    label: "가치 찾기",
    description: "그 상황·감정 속에 담긴 도덕적 가치(배려·정직·용기 등)를 찾습니다.",
    studentHeading: "✨ 어떤 가치가 담겨 있었나요?",
  },
  perspective: {
    track: "reflection",
    emoji: "🔄",
    label: "상대 입장 바꿔 보기",
    description: "그 상황에서 상대가 어떤 마음·생각이었을지 입장을 바꿔 생각합니다.",
    studentHeading: "🔄 상대는 어땠을까요?",
  },
  resolution: {
    track: "reflection",
    emoji: "🌱",
    label: "다음엔 어떻게",
    description: "이 일을 통해 배운 것을 다짐으로 정리합니다.",
    studentHeading: "🌱 다음엔 어떻게 할까요?",
  },

  // ── 가치 판단·실천 트랙 ──
  dilemma: {
    track: "judgement",
    emoji: "❓",
    label: "가치 갈등 인식",
    description: "두 가지 가치가 부딪치는 상황을 명확하게 정의합니다.",
    studentHeading: "❓ 어떤 가치가 부딪치나요?",
  },
  stakeholders: {
    track: "judgement",
    emoji: "👥",
    label: "입장별 분석",
    description: "이 상황과 관련된 사람들의 입장과 감정을 각각 분석합니다.",
    studentHeading: "👥 사람마다 입장이 어떻게 다른가요?",
  },
  principle: {
    track: "judgement",
    emoji: "📐",
    label: "도덕 원칙 적용",
    description: "역지사지·황금률 같은 도덕 원칙을 가져와 이 상황을 판단합니다.",
    studentHeading: "📐 어떤 도덕 원칙으로 판단할까요?",
  },
  consequence: {
    track: "judgement",
    emoji: "🔮",
    label: "결과 예측",
    description: "선택한 행동이 가져올 결과를 단기·장기로 나누어 예측합니다.",
    studentHeading: "🔮 이렇게 하면 어떻게 될까요?",
  },
  action_plan: {
    track: "judgement",
    emoji: "📝",
    label: "실천 계획",
    description: "구체적인 실천 행동과 점검 방법을 적어 약속을 만듭니다.",
    studentHeading: "📝 어떻게 실천할까요?",
  },
  self_review: {
    track: "judgement",
    emoji: "🪞",
    label: "사후 성찰",
    description: "시간이 지난 뒤 자신의 행동을 되돌아보고 보완할 점을 적습니다.",
    studentHeading: "🪞 지나고 보니 어땠나요?",
  },
};

// =====================================================
// 카드 라이브러리 — 학생이 고르기 쉽게 정해진 어휘
// =====================================================

/** 감정 카드 — 초등 정서 어휘 (긍정·부정·복합) */
export const EMOTION_CARDS: { label: string; emoji: string; tone: "joy" | "anger" | "sad" | "fear" | "mixed" }[] = [
  // 기쁨 계열
  { label: "기쁨", emoji: "😊", tone: "joy" },
  { label: "뿌듯함", emoji: "🥰", tone: "joy" },
  { label: "신남", emoji: "🤩", tone: "joy" },
  { label: "고마움", emoji: "🙏", tone: "joy" },
  { label: "사랑", emoji: "💕", tone: "joy" },
  // 화 계열
  { label: "화남", emoji: "😠", tone: "anger" },
  { label: "짜증남", emoji: "😤", tone: "anger" },
  { label: "억울함", emoji: "😣", tone: "anger" },
  { label: "분함", emoji: "😡", tone: "anger" },
  // 슬픔 계열
  { label: "슬픔", emoji: "😢", tone: "sad" },
  { label: "서운함", emoji: "🥺", tone: "sad" },
  { label: "외로움", emoji: "😔", tone: "sad" },
  { label: "후회", emoji: "😞", tone: "sad" },
  { label: "미안함", emoji: "🥺", tone: "sad" },
  // 두려움 계열
  { label: "두려움", emoji: "😨", tone: "fear" },
  { label: "걱정", emoji: "😟", tone: "fear" },
  { label: "긴장", emoji: "😬", tone: "fear" },
  { label: "부끄러움", emoji: "😳", tone: "fear" },
  // 복합
  { label: "당황", emoji: "😵", tone: "mixed" },
  { label: "놀람", emoji: "😲", tone: "mixed" },
  { label: "혼란", emoji: "😕", tone: "mixed" },
  { label: "샘남(부러움)", emoji: "😒", tone: "mixed" },
];

/** 가치 카드 — 초등 도덕과 핵심 가치 */
export const VALUE_CARDS: { label: string; emoji: string; area: "self" | "others" | "society" | "nature" }[] = [
  // 자신과의 관계
  { label: "성실", emoji: "🌱", area: "self" },
  { label: "절제", emoji: "⏸️", area: "self" },
  { label: "자존", emoji: "🌟", area: "self" },
  { label: "용기", emoji: "🦁", area: "self" },
  // 타인과의 관계
  { label: "배려", emoji: "🤝", area: "others" },
  { label: "정직", emoji: "🪞", area: "others" },
  { label: "공감", emoji: "💗", area: "others" },
  { label: "존중", emoji: "🙇", area: "others" },
  { label: "약속", emoji: "🤙", area: "others" },
  // 사회·공동체
  { label: "책임", emoji: "💪", area: "society" },
  { label: "협동", emoji: "👫", area: "society" },
  { label: "정의", emoji: "⚖️", area: "society" },
  { label: "공정", emoji: "🟰", area: "society" },
  { label: "준법", emoji: "📜", area: "society" },
  // 자연·세계
  { label: "생명존중", emoji: "🌿", area: "nature" },
  { label: "평화", emoji: "🕊️", area: "nature" },
  { label: "감사", emoji: "🙏", area: "nature" },
];

/** 도덕 원칙 카드 (judgement 트랙 principle 단계에서 사용) */
export const PRINCIPLE_CARDS: { label: string; description: string }[] = [
  { label: "역지사지", description: "상대 입장에서 다시 생각해 보기" },
  { label: "황금률", description: "내가 받고 싶은 대로 남에게 하기" },
  { label: "최대 다수의 행복", description: "더 많은 사람에게 좋은 쪽 선택" },
  { label: "약자 보호", description: "도움이 필요한 사람을 먼저 생각" },
  { label: "약속·규칙 지키기", description: "함께 정한 약속을 우선" },
  { label: "정직이 먼저", description: "결과보다 거짓 없는 행동" },
];

// =====================================================
// 스킬별 세부 설정 — 교사가 활동마다 켜는 옵션
// =====================================================

export interface SituationSettings {
  promptWhen: boolean;
  promptWhere: boolean;
  promptWho: boolean;
  useDrawing: boolean;
}
export interface EmotionSettings {
  enabledTones: ("joy" | "anger" | "sad" | "fear" | "mixed")[];
  allowMultiple: boolean;
  promptIntensity: boolean;     // 1~5 강도 묻기
}
export interface ValueFindSettings {
  enabledAreas: ("self" | "others" | "society" | "nature")[];
  requireReason: boolean;       // 왜 이 가치인지
}
export interface PerspectiveSettings {
  partyCount: number;           // 1~3명
  promptFeeling: boolean;
}
export interface ResolutionSettings {
  useTemplate: boolean;         // "다음에 ~한 상황이 오면 ~ 하겠다"
  askPracticePartner: boolean;  // 같이 실천할 친구 / 도움 요청
}

export interface DilemmaSettings {
  useTwoValueTemplate: boolean; // "A vs B" 형식
  promptContext: boolean;       // 왜 갈등 상황인지
}
export interface StakeholdersSettings {
  partyCount: number;           // 2~4명
  requireFeeling: boolean;
  requireNeed: boolean;         // 그 사람이 원하는 것
}
export interface PrincipleSettings {
  enabledPrinciples: string[];  // PRINCIPLE_CARDS 의 label 목록
  requireApplication: boolean;  // 원칙을 이 상황에 어떻게 적용했는지
}
export interface ConsequenceSettings {
  splitShortLong: boolean;      // 단기·장기 결과 분리
  considerOthers: boolean;      // 나·상대·공동체 영향
}
export interface ActionPlanSettings {
  useChecklistFormat: boolean;  // 점검표 형식 (언제·어떻게)
  askObstacles: boolean;        // 방해 요인과 극복 방법
}
export interface SelfReviewSettings {
  followUpDays: number;         // 며칠 뒤 다시 쓰기 (UI 안내용)
  askProgress: boolean;         // 실천 진행 상황
  askAdjustment: boolean;       // 보완할 점
}

export type MoralsSkillSettings = {
  situation?: SituationSettings;
  emotion?: EmotionSettings;
  value_find?: ValueFindSettings;
  perspective?: PerspectiveSettings;
  resolution?: ResolutionSettings;
  dilemma?: DilemmaSettings;
  stakeholders?: StakeholdersSettings;
  principle?: PrincipleSettings;
  consequence?: ConsequenceSettings;
  action_plan?: ActionPlanSettings;
  self_review?: SelfReviewSettings;
};

export const DEFAULT_MORALS_SKILL_SETTINGS: Required<MoralsSkillSettings> = {
  situation: { promptWhen: true, promptWhere: true, promptWho: true, useDrawing: false },
  emotion: { enabledTones: ["joy", "anger", "sad", "fear", "mixed"], allowMultiple: true, promptIntensity: false },
  value_find: { enabledAreas: ["self", "others", "society", "nature"], requireReason: true },
  perspective: { partyCount: 1, promptFeeling: true },
  resolution: { useTemplate: true, askPracticePartner: false },
  dilemma: { useTwoValueTemplate: true, promptContext: true },
  stakeholders: { partyCount: 3, requireFeeling: true, requireNeed: true },
  principle: { enabledPrinciples: PRINCIPLE_CARDS.map((p) => p.label), requireApplication: true },
  consequence: { splitShortLong: true, considerOthers: true },
  action_plan: { useChecklistFormat: true, askObstacles: false },
  self_review: { followUpDays: 7, askProgress: true, askAdjustment: true },
};

// =====================================================
// 학생 세션이 채우는 스킬 데이터
// =====================================================

export type MoralsSkillData = {
  situation?: {
    when: string;
    where: string;
    who: string;
    summary: string;
    drawingData: string;
  };
  emotion?: {
    /** 카드 label 목록 + 강도(있을 때) */
    selected: Array<{ label: string; intensity?: number }>;
    note: string;
  };
  value_find?: {
    values: string[];   // VALUE_CARDS.label
    reason: string;
  };
  perspective?: {
    /** 입장별 — [{ role: "친구", feeling: "...", thought: "..." }] */
    parties: Array<{ role: string; feeling: string; thought: string }>;
  };
  resolution?: {
    resolution: string;
    practicePartner: string;
  };
  dilemma?: {
    valueA: string;
    valueB: string;
    context: string;
  };
  stakeholders?: {
    parties: Array<{ role: string; feeling: string; need: string }>;
  };
  principle?: {
    /** 선택한 원칙 + 적용 설명 */
    appliedPrinciples: Array<{ label: string; application: string }>;
  };
  consequence?: {
    shortTerm: string;
    longTerm: string;
    impactSelf: string;
    impactOthers: string;
  };
  action_plan?: {
    actions: Array<{ when: string; what: string; how: string }>;
    obstacles: string;
  };
  self_review?: {
    progress: string;
    adjustment: string;
    feeling: string;
  };
};

// =====================================================
// 교사 방 / 학생 세션 / 동료 반응
// =====================================================

export interface MoralsRoom {
  id: string;
  teacher_id: string;
  class_id: string | null;
  title: string;
  topic: string;             // 활동 주제 (예: "내가 친구와 다툰 어제")
  instructions: string;
  track: MoralsTrack;
  enabledSkills: MoralsSkillKey[];
  skillSettings: MoralsSkillSettings;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface MoralsSession {
  id: string;
  room_id: string;
  student_number: number;
  student_name: string;
  skillData: MoralsSkillData;
  completedSkills: MoralsSkillKey[];
  status: "in_progress" | "done";
  created_at: string;
  updated_at: string;
}

export interface MoralsReactionRow {
  id: string;
  room_id: string;
  reviewer_session_id: string;
  target_session_id: string;
  reaction: MoralsReaction;
  created_at: string;
}

export const MORALS_REACTION_META: Record<MoralsReaction, { emoji: string; label: string; color: string }> = {
  empathy: { emoji: "💗", label: "나도 그래", color: "bg-rose-50 text-rose-600" },
  reflect: { emoji: "💭", label: "나도 생각해 볼게", color: "bg-violet-50 text-violet-600" },
  respect: { emoji: "👍", label: "멋진 생각이야", color: "bg-emerald-50 text-emerald-600" },
};
