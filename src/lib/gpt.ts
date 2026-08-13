import { callAgitAi, parseAiJsonObject } from "@/lib/agit-ai";


export interface GeneratedRoleData {
  label: string;
  subtitle: string;
  description: string;
  icon: string;
  cardSets: {
    label: string;
    description: string;
    prompts: string[];
  }[];
}

export async function generateAiRolesAndQuestions(
  labActorId: string,
  topic: string,
  gradeLevel: string,
  roleCount: number
): Promise<GeneratedRoleData[]> {
  const gradeDesc = {
    "저학년": "초등학교 1~2학년 (매우 쉽고 직관적인 언어, 이모지 활용 권장)",
    "중학년": "초등학교 3~4학년 (쉬운 어휘, 친근하고 명확한 설명)",
    "고학년": "초등학교 5~6학년 (다양한 어휘와 깊이 있는 사고 유도)",
  }[gradeLevel as "저학년" | "중학년" | "고학년"] ?? gradeLevel;

  const prompt = `
초등학교 글쓰기 수업을 위한 "질문 만들기(활동)"에서 학생들이 몰입하여 질문을 탐색할 수 있도록 돕는 **가상의 연구원 역할(Role)**과 각 역할별 **질문 카드 세트**를 생성해주세요.

### 조건:
- **수업 주제**: ${topic}
- **대상 학생**: ${gradeDesc}
- **생성할 연구원 역할 개수**: ${roleCount}개

### 연구원 역할(Role) 정의 가이드:
- 학생들이 친근하게 몰입할 수 있도록 귀엽고 매력적인 페르소나와 이름을 붙여주세요. (예: 주제가 '환경 보호'라면 '초록 지구 파수꾼', '재활용 박사', '플라스틱 수사관' 등)
- 각 역할마다 어울리는 대표 **아이콘 이모지(icon)** 하나를 선정해주세요. (예: 🕵️, 🌍, 🌿)
- **짧은 성격 설명(subtitle)**은 그 역할의 정체성을 한 눈에 드러내는 3~4글자의 요약어로 적어주세요. (예: "사실/조사", "상상/창의", "실천/다짐")
- **역할 설명(description)**은 학생에게 보여줄 친절하고 명확한 1~2문장의 안내글로 작성해주세요.

### 질문 카드 세트(cardSets) 가이드:
- 각 연구원 역할마다 **최소 1개 이상의 질문 카드 묶음(cardSet)**을 만듭니다. (일반적으로 역할당 1~2개의 카드 세트가 적절합니다.)
- 카드 세트의 **이름(label)**을 정해주세요. (예: '숨은 쓰레기 찾기', '내일의 지구 계획')
- 카드 세트의 **설명(description)**은 학생들이 어떤 방향으로 질문을 던져야 하는지 유도해주는 짧은 한 문장입니다.
- **질문 카드(prompts)**는 학생들이 질문을 만들 때 참고할 **구체적인 질문 힌트 목록**입니다. 
  - 각 카드 세트당 **반드시 정확히 10개**의 서로 다른 질문 힌트를 리스트로 만드세요. (10개 미만이나 초과는 절대 안 되며, 정확히 10개여야 합니다.)
  - 질문 힌트는 학생들이 오늘 주제에 맞는 질문을 스스로 조립하거나 영감을 얻을 수 있도록 주어와 빈칸 등을 적절히 섞거나 구체적으로 예시 형태의 문장으로 제시해주세요.
  - 문맥은 반드시 대상 학년(${gradeDesc}) 수준에 맞추어 지나치게 학술적이거나 복잡한 표현은 피하고 초등학생이 이해하기 쉬운 톤앤매너로 작성하세요.

반드시 아래 JSON 형식으로만 응답해야 합니다:
{
  "roles": [
    {
      "label": "역할 이름",
      "subtitle": "짧은 성격 설명",
      "description": "역할 설명",
      "icon": "🕵️",
      "cardSets": [
        {
          "label": "카드 묶음 이름",
          "description": "카드 묶음 설명",
          "prompts": [
            "질문 힌트 1",
            "질문 힌트 2",
            "질문 힌트 3",
            "질문 힌트 4",
            "질문 힌트 5",
            "질문 힌트 6",
            "질문 힌트 7",
            "질문 힌트 8",
            "질문 힌트 9",
            "질문 힌트 10"
          ]
        }
      ]
    }
  ]
}
`;

  const parsed = parseAiJsonObject(await callAgitAi(labActorId, prompt));
  return (parsed.roles || []) as GeneratedRoleData[];
}

export type SpellCorrectionInput = { id: string; text: string };
export type SpellCorrectionResult = { id: string; corrected: string };

export async function correctKoreanSpelling(
  labActorId: string,
  inputs: SpellCorrectionInput[],
): Promise<SpellCorrectionResult[]> {
  if (inputs.length === 0) return [];
  const prompt = `초등학생이 만든 한국어 질문 문장들의 맞춤법·띄어쓰기·문장부호·조사 오류만 교정해 주세요.

규칙:
- 의미·어조·표현은 절대 바꾸지 마세요. 단어 선택을 더 멋지게 만들거나 의역하지 마세요.
- 외래어/이름/방언/일부러 쓴 표현은 그대로 두세요.
- 문장 내용이 이미 맞다면 원문 그대로 반환하세요(빈 문자열 금지).
- 줄바꿈은 원문 구조를 유지하세요.

입력 형식: 각 항목은 {id, text} 객체.
출력 형식(JSON): {"results":[{"id":"<id>","corrected":"<교정된 문장>"}, ...]}
- 입력의 모든 id를 빠짐없이 포함하세요.
- corrected는 원문이든 교정문이든 빈 문자열 없이 반드시 채워주세요.

입력:
${JSON.stringify(inputs)}`;

  const parsed = parseAiJsonObject(await callAgitAi(labActorId, prompt)) as { results?: unknown };
  if (!Array.isArray(parsed.results)) return [];

  return parsed.results
    .filter((entry): entry is { id: string; corrected: string } => {
      return typeof entry === "object"
        && entry !== null
        && typeof (entry as { id?: unknown }).id === "string"
        && typeof (entry as { corrected?: unknown }).corrected === "string";
    })
    .map((entry) => ({ id: entry.id, corrected: entry.corrected }));
}

export type GeneratedHanjaCard = {
  word: string;
  isHanjaWord: boolean;
  rejectionReason: string;
  hanja: Array<{ char: string; reading: string; meaning: string }>;
  relatedWords: Array<{ word: string; hanja: string; meaning: string; sharedChar: string }>;
  definition: string;
  example: string;
  category: string;
};

export async function generateHanjaWordCard(
  labActorId: string,
  word: string,
  grade: number,
): Promise<GeneratedHanjaCard> {
  const prompt = `초등학교 ${grade}학년 학생을 위한 한자 학습 카드를 만들어 주세요.

대상 단어: "${word}"

요구 사항:
0. 먼저 이 단어가 사전적으로 널리 쓰이는 한자어인지 판단하세요.
   - 순우리말, 외래어, 의성어/의태어, 한자 표기가 불분명한 단어, 확신할 수 없는 단어는 한자어로 처리하지 마세요.
   - 추정해서 한자를 붙이거나 억지로 뜻을 만들면 안 됩니다.
   - 확실하지 않으면 반드시 isHanjaWord를 false로 두세요.
1. 한자어인 경우에만 단어를 구성하는 한자(漢字)를 분해하여 각 글자의 음(소리)과 훈(뜻)을 알려주세요.
   - 한자어가 아니면 hanja는 빈 배열로 반환하세요.
2. 같은 한자를 공유하는 관련 단어(어휘) 4~6개를 제시해 주세요.
   - 각 단어의 한자 표기와 초등학생도 이해할 수 있는 짧은 뜻 설명을 포함하세요.
   - sharedChar에는 대상 단어와 공유하는 한자(예: "家")를 표기하세요.
   - 한자어가 아니면 relatedWords는 빈 배열로 반환하세요.
3. 단어의 뜻(definition)은 초등 ${grade}학년이 이해할 수 있는 친근한 말로 1문장 설명해 주세요.
4. 예시 문장(example)은 학생이 따라 떠올릴 수 있는 일상적인 1문장으로 작성해 주세요.
5. category는 단어의 의미 분류(예: "가족과 이웃", "감정과 행동", "자연과 환경" 등).
6. 한자어가 아니면 definition, example, category는 빈 문자열로 두고, rejectionReason에 짧게 이유를 적어 주세요.

반드시 아래 JSON 형식으로만 응답:
{
  "word": "${word}",
  "isHanjaWord": true,
  "rejectionReason": "",
  "hanja": [{"char":"한자","reading":"음","meaning":"훈"}, ...],
  "relatedWords": [{"word":"단어","hanja":"漢字표기","meaning":"뜻","sharedChar":"공유한자"}, ...],
  "definition": "단어 뜻 한 줄 설명",
  "example": "예시 문장",
  "category": "분류"
}`;

  const parsed = parseAiJsonObject(await callAgitAi(labActorId, prompt)) as Partial<GeneratedHanjaCard>;
  return {
    word: typeof parsed.word === "string" && parsed.word.trim() ? parsed.word.trim() : word,
    isHanjaWord: parsed.isHanjaWord === true,
    rejectionReason: typeof parsed.rejectionReason === "string" ? parsed.rejectionReason.trim() : "",
    hanja: Array.isArray(parsed.hanja)
      ? parsed.hanja
          .filter((entry): entry is { char: string; reading: string; meaning: string } =>
            typeof entry === "object" && entry !== null
            && typeof (entry as { char?: unknown }).char === "string"
            && typeof (entry as { reading?: unknown }).reading === "string"
            && typeof (entry as { meaning?: unknown }).meaning === "string")
          .map((entry) => ({
            char: entry.char.trim(),
            reading: entry.reading.trim(),
            meaning: entry.meaning.trim(),
          }))
      : [],
    relatedWords: Array.isArray(parsed.relatedWords)
      ? parsed.relatedWords
          .filter((entry): entry is { word: string; hanja: string; meaning: string; sharedChar: string } =>
            typeof entry === "object" && entry !== null
            && typeof (entry as { word?: unknown }).word === "string"
            && typeof (entry as { meaning?: unknown }).meaning === "string")
          .map((entry) => ({
            word: entry.word.trim(),
            hanja: typeof entry.hanja === "string" ? entry.hanja.trim() : "",
            meaning: entry.meaning.trim(),
            sharedChar: typeof entry.sharedChar === "string" ? entry.sharedChar.trim() : "",
          }))
      : [],
    definition: typeof parsed.definition === "string" ? parsed.definition.trim() : "",
    example: typeof parsed.example === "string" ? parsed.example.trim() : "",
    category: typeof parsed.category === "string" ? parsed.category.trim() : "",
  };
}
