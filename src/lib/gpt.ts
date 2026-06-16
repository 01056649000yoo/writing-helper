import OpenAI from "openai";
import type { SubjectType, GradeLevel, OutlineDepth } from "@/types";
import type { OutlineTemplateAnswer } from "@/features/activities/types";

export function createOpenAIClient(apiKey: string) {
  return new OpenAI({ apiKey });
}

type SubjectStructure = {
  /** 글 종류의 전체적인 짜임새와 글쓴이가 해야 할 일 */
  philosophy: string;
  /** 단계 수별 섹션 제목 — simple=3, medium=4, detailed=5 */
  sections: { 3: readonly string[]; 4: readonly string[]; 5: readonly string[] };
};

const SUBJECT_STRUCTURES: Record<SubjectType, SubjectStructure> = {
  "생활문": {
    philosophy: "실제 경험한 일을 시간 순서로 풀어내며 '무슨 일이 어떻게 일어났고 무엇을 느꼈는지' 보여주는 글",
    sections: {
      3: ["일이 시작된 상황", "일의 흐름과 변화", "느낀 점과 배운 점"],
      4: ["일이 시작된 상황", "일의 첫 번째 흐름", "일의 두 번째 흐름", "느낀 점과 배운 점"],
      5: ["일이 시작된 상황", "일의 시작", "중심 사건", "사건의 마무리", "느낀 점과 배운 점"],
    },
  },
  "일기": {
    philosophy: "오늘 있었던 일과 그때의 솔직한 마음·다짐을 기록하는 글 (날짜·날씨·하루의 흐름 중심)",
    sections: {
      3: ["오늘의 시작과 분위기", "가장 기억에 남는 일", "오늘의 마음과 다짐"],
      4: ["오늘의 시작과 분위기", "있었던 일 ①", "있었던 일 ②", "오늘의 마음과 다짐"],
      5: ["오늘의 시작과 분위기", "있었던 일 ①", "있었던 일 ②", "있었던 일 ③", "오늘의 마음과 다짐"],
    },
  },
  "편지": {
    philosophy: "받는 사람에게 마음과 소식을 전하는 글 (인사말 → 본문 → 끝인사·보내는 사람 구조)",
    sections: {
      3: ["인사말과 안부", "전하고 싶은 마음·소식", "끝인사와 보내는 사람"],
      4: ["인사말과 안부", "전하고 싶은 말 ①", "전하고 싶은 말 ②", "끝인사와 보내는 사람"],
      5: ["인사말과 안부", "전하고 싶은 말 ①", "전하고 싶은 말 ②", "전하고 싶은 말 ③", "끝인사와 보내는 사람"],
    },
  },
  "독서감상문": {
    philosophy: "읽은 책의 줄거리·인물·장면을 떠올리고 그에 대한 나의 생각·느낌을 엮는 글",
    sections: {
      3: ["책 소개와 읽게 된 이유", "인상 깊은 장면과 인물", "느낀 점과 배운 점"],
      4: ["책 소개와 읽게 된 이유", "줄거리 간추리기", "인상 깊은 장면과 인물", "느낀 점과 배운 점"],
      5: ["책 소개와 읽게 된 이유", "줄거리 간추리기", "인상 깊은 장면", "인물에 대한 내 생각", "느낀 점과 배운 점"],
    },
  },
  "기행문": {
    philosophy: "여행지에서 보고·듣고·느낀 것을 장소나 시간 순서로 풀어내는 글",
    sections: {
      3: ["출발과 도착(여정의 시작)", "보고 듣고 한 일", "여행을 마치고 느낀 점"],
      4: ["출발과 도착(여정의 시작)", "첫 번째 장소에서 한 일", "두 번째 장소에서 한 일", "여행을 마치고 느낀 점"],
      5: ["출발과 도착(여정의 시작)", "첫 번째 장소", "두 번째 장소", "세 번째 장소", "여행을 마치고 느낀 점"],
    },
  },
  "관찰기록문": {
    philosophy: "관찰 대상의 모양·색·소리·움직임·변화를 자세하고 정확하게 기록하는 글",
    sections: {
      3: ["관찰 대상과 환경", "관찰한 특징과 변화", "관찰을 통해 알게 된 점"],
      4: ["관찰 대상과 환경", "모양과 색깔", "움직임과 변화", "관찰을 통해 알게 된 점"],
      5: ["관찰 대상과 환경", "모양과 색깔", "소리·냄새·촉감", "움직임과 변화", "관찰을 통해 알게 된 점"],
    },
  },
  "이야기 글": {
    philosophy: "상상 속 인물·사건·배경을 바탕으로 발단→전개→결말 흐름을 만드는 글",
    sections: {
      3: ["배경과 인물 소개(발단)", "사건의 전개·갈등", "결말과 이야기의 주제"],
      4: ["배경과 인물 소개(발단)", "사건의 전개", "사건의 위기·고비", "결말과 이야기의 주제"],
      5: ["배경과 인물 소개(발단)", "사건의 전개", "사건의 위기", "사건의 절정", "결말과 이야기의 주제"],
    },
  },
  "설명하는 글": {
    philosophy: "대상의 특징·종류·방법을 정확하고 분명하게 알려주는 글 (주관적 감정보다 사실 중심)",
    sections: {
      3: ["설명할 대상과 설명하는 이유", "특징·방법·과정", "정리와 덧붙임"],
      4: ["설명할 대상과 설명하는 이유", "첫 번째 특징/방법", "두 번째 특징/방법", "정리와 덧붙임"],
      5: ["설명할 대상과 설명하는 이유", "첫 번째 특징/방법", "두 번째 특징/방법", "세 번째 특징/방법", "정리와 덧붙임"],
    },
  },
  "주장하는 글": {
    philosophy: "내가 옳다고 믿는 주장을 펼치고 근거로 뒷받침하는 글 (서론-본론-결론 논리 구조)",
    sections: {
      3: ["문제 상황과 내 주장", "주장을 뒷받침하는 근거", "주장 강조와 실천 호소"],
      4: ["문제 상황과 내 주장", "근거 ①", "근거 ②", "주장 강조와 실천 호소"],
      5: ["문제 상황과 내 주장", "근거 ①", "근거 ②", "근거 ③", "주장 강조와 실천 호소"],
    },
  },
  "소개하는 글": {
    philosophy: "인물·장소·물건 등 한 가지 대상을 다른 사람에게 알기 쉽게 알려주는 글",
    sections: {
      3: ["소개할 대상과 소개 이유", "대상의 자세한 특징", "추천 한 마디와 마무리"],
      4: ["소개할 대상과 소개 이유", "겉모습과 첫인상", "성격·기능·특기", "추천 한 마디와 마무리"],
      5: ["소개할 대상과 소개 이유", "겉모습과 첫인상", "성격·기능·특기", "재미있는 점이나 사연", "추천 한 마디와 마무리"],
    },
  },
  "동시": {
    philosophy: "리듬·비유·반복으로 마음과 장면을 짧게 표현하는 글 (행 단위로 압축적 표현)",
    sections: {
      3: ["첫 장면과 첫 마음", "비유·반복으로 표현한 마음", "여운과 마무리"],
      4: ["첫 장면과 첫 마음", "장면 ①", "장면 ②", "여운과 마무리"],
      5: ["첫 장면과 첫 마음", "장면 ①", "장면 ②", "장면 ③", "여운과 마무리"],
    },
  },
  "보고서": {
    philosophy: "조사·실험한 주제·방법·결과를 사실대로 정리하는 글 (의견과 사실을 구분)",
    sections: {
      3: ["조사 주제와 조사한 이유", "조사 방법과 결과", "결론과 알게 된 점"],
      4: ["조사 주제와 조사한 이유", "조사·실험 방법", "조사·실험 결과", "결론과 알게 된 점"],
      5: ["조사 주제와 조사한 이유", "조사·실험 방법", "조사·실험 결과 ①", "조사·실험 결과 ②", "결론과 알게 된 점"],
    },
  },
};

function depthSectionCount(outlineDepth: OutlineDepth): 3 | 4 | 5 {
  return outlineDepth === "simple" ? 3 : outlineDepth === "medium" ? 4 : 5;
}

function getSubjectStructure(subjectType: SubjectType, outlineDepth: OutlineDepth) {
  const structure = SUBJECT_STRUCTURES[subjectType];
  const sections = structure.sections[depthSectionCount(outlineDepth)];
  return { philosophy: structure.philosophy, sections };
}

export async function generateOutline(
  apiKey: string,
  topic: string,
  topicDescription: string,
  subjectType: SubjectType,
  gradeLevel: GradeLevel,
  answers: OutlineTemplateAnswer[],
): Promise<string> {
  const client = createOpenAIClient(apiKey);

  const { philosophy } = getSubjectStructure(subjectType, "simple");
  const gradeDesc = { "저학년": "1~2학년", "중학년": "3~4학년", "고학년": "5~6학년" }[gradeLevel];

  const topicContext = topicDescription.trim()
    ? `"${topic}" (${topicDescription.trim()})`
    : `"${topic}"`;

  const sections = ["처음", "가운데", "끝"] as const;
  const sectionAnswersText = sections.map((section) => {
    const sectionItems = answers.filter((a) => a.section === section);
    if (sectionItems.length === 0) return null;
    const itemsText = sectionItems.map((a) => `  - ${a.label}: ${a.answer}`).join("\n");
    return `[${section}]\n${itemsText}`;
  }).filter(Boolean).join("\n\n");

  const prompt = `초등학교 ${gradeDesc} 학생이 ${topicContext}을 주제로 "${subjectType}"을 씁니다.
글 종류의 짜임새: ${philosophy}

학생이 입력한 내용:
${sectionAnswersText}

위 내용을 바탕으로 처음·가운데·끝 3단계 개요를 만들어주세요.

[작성 규칙]
- 각 단계마다 "✏️ <단계> | <한 문장 요약>" 형식으로 작성합니다.
- 한 문장 요약은 20자 내외로 학생이 입력한 핵심 내용이 자연스럽게 드러나야 합니다.
- 키워드 나열 금지. 반드시 주어+서술어가 있는 짧은 문장이어야 합니다.
- "${subjectType}"의 글 성격에 맞는 어조로 씁니다.
- 각 단계 사이에 빈 줄 두 칸을 둡니다.

출력 예시:
✏️ 처음 | (학생 내용을 반영한 짧은 한 문장)


✏️ 가운데 | (학생 내용을 반영한 짧은 한 문장)


✏️ 끝 | (학생 내용을 반영한 짧은 한 문장)`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8,
  });

  return response.choices[0].message.content ?? "";
}

export async function generateDraftFromAnswers(
  apiKey: string,
  topic: string,
  topicDescription: string,
  subjectType: SubjectType,
  gradeLevel: GradeLevel,
  answers: OutlineTemplateAnswer[],
): Promise<string> {
  const client = createOpenAIClient(apiKey);

  const gradeDesc = { "저학년": "1~2학년", "중학년": "3~4학년", "고학년": "5~6학년" }[gradeLevel];
  const { philosophy } = getSubjectStructure(subjectType, "simple");

  const topicContext = topicDescription.trim()
    ? `"${topic}" (${topicDescription.trim()})`
    : `"${topic}"`;

  const sections = ["처음", "가운데", "끝"] as const;
  const sectionAnswersText = sections.map((section) => {
    const sectionItems = answers.filter((a) => a.section === section);
    if (sectionItems.length === 0) return null;
    const itemsText = sectionItems.map((a) => `  - ${a.label}: ${a.answer}`).join("\n");
    return `[${section}]\n${itemsText}`;
  }).filter(Boolean).join("\n\n");

  const prompt = `초등학교 ${gradeDesc} 학생이 ${topicContext}을 주제로 "${subjectType}"을 씁니다.
글 종류의 짜임새: ${philosophy}

학생이 입력한 내용:
${sectionAnswersText}

위 내용을 바탕으로, 학생이 고쳐쓰기 좋도록 2~3문단의 짧은 초고를 만들어주세요.

[규칙]
- 완성된 모범답안처럼 매끈하게 쓰지 마세요. 학생이 직접 고쳐 쓸 여지를 남기세요.
- 학생이 입력한 말과 표현을 최대한 살리세요.
- 처음·가운데·끝 흐름에 맞게 문단을 나눠 쓰세요.
- "${subjectType}"의 형식을 지키세요. (편지면 받는 사람·인사말·끝인사, 동시면 짧은 행과 운율 등)
- 제목 없이 본문만 쓰세요. 불릿, 번호, 이모지 사용 금지.
- 문단 사이는 빈 줄 한 줄.`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8,
  });

  return response.choices[0].message.content ?? "";
}

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
  apiKey: string,
  topic: string,
  gradeLevel: string,
  roleCount: number
): Promise<GeneratedRoleData[]> {
  const client = createOpenAIClient(apiKey);

  const gradeDesc = {
    "저학년": "초등학교 1~2학년 (매우 쉽고 직관적인 언어, 이모지 활용 권장)",
    "중학년": "초등학교 3~4학년 (쉬운 어휘, 친근하고 명확한 설명)",
    "고학년": "초등학교 5~6학년 (다양한 어휘와 깊이 있는 사고 유도)",
  }[gradeLevel as GradeLevel] ?? gradeLevel;

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

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("GPT 응답이 비어있습니다.");

  const parsed = JSON.parse(content);
  return (parsed.roles || []) as GeneratedRoleData[];
}

export type SpellCorrectionInput = { id: string; text: string };
export type SpellCorrectionResult = { id: string; corrected: string };

export async function correctKoreanSpelling(
  apiKey: string,
  inputs: SpellCorrectionInput[],
): Promise<SpellCorrectionResult[]> {
  if (inputs.length === 0) return [];
  const client = createOpenAIClient(apiKey);

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

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("GPT 응답이 비어있습니다.");
  const parsed = JSON.parse(content) as { results?: unknown };
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
  apiKey: string,
  word: string,
  grade: number,
): Promise<GeneratedHanjaCard> {
  const client = createOpenAIClient(apiKey);

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

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("GPT 응답이 비어있습니다.");

  const parsed = JSON.parse(content) as Partial<GeneratedHanjaCard>;
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
