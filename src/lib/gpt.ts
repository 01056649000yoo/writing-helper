import OpenAI from "openai";
import type { QuestionSets, SubjectType, GradeLevel, OutlineDepth, Answer } from "@/types";

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

export async function generateQuestionSets(
  apiKey: string,
  topic: string,
  topicDescription: string,
  subjectType: SubjectType,
  gradeLevel: GradeLevel,
  outlineDepth: OutlineDepth
): Promise<QuestionSets> {
  const client = createOpenAIClient(apiKey);

  const sectionCount = depthSectionCount(outlineDepth);
  const { philosophy, sections } = getSubjectStructure(subjectType, outlineDepth);
  const sectionListText = sections.map((title, index) => `${index + 1}. ${title}`).join("\n");

  const gradeDesc = {
    "저학년": "초등학교 1~2학년 (매우 쉬운 단어, 짧은 문장)",
    "중학년": "초등학교 3~4학년 (쉬운 단어, 보통 문장)",
    "고학년": "초등학교 5~6학년 (다양한 어휘, 깊이 있는 사고)",
  }[gradeLevel];

  const topicSection = topicDescription.trim()
    ? `- 글 주제: ${topic}\n- 주제 부연 설명: ${topicDescription.trim()}`
    : `- 글 주제: ${topic}`;

  const prompt = `
초등학생 글쓰기 교육 전문가로서 아래 조건에 맞는 글쓰기 도움 질문 세트를 만들어주세요.

조건:
${topicSection}
- 글 종류: ${subjectType}
- 글 종류의 짜임새: ${philosophy}
- 대상: ${gradeDesc}
- 이 글은 다음 ${sectionCount}개 단계(개요 구조)로 정리됩니다:
${sectionListText}

[질문 생성 핵심 원칙 — 반드시 준수]
- 질문은 위 ${sectionCount}개 단계의 순서대로 정렬되어야 합니다.
- 각 단계마다 그 단계에 들어갈 내용을 끌어내는 질문을 1개씩 만듭니다. (총 ${sectionCount}개 또는 ${sectionCount + 1}개)
- 질문은 반드시 "${subjectType}"이라는 글 종류의 짜임새에 맞아야 합니다. 예) 편지라면 받는 사람·인사말·전할 말·끝인사를 묻고, 주장하는 글이라면 주장·근거·결론을 묻습니다. 일반적인 "처음/중간/끝" 질문이 아닙니다.
- 마지막 단계가 "느낀 점·결론·끝인사" 류일 경우 그에 맞는 마무리 질문을 만드세요.

3가지 수준별 질문 세트를 만들어주세요 (단계 순서는 동일):
1. low (글쓰기가 어려운 학생): 매우 구체적이고 단순한 질문, type은 반드시 "card+input" 사용 — 카드 선택만 해도 넘어갈 수 있으므로 직접 입력은 선택 사항
2. mid (보통 학생): 적당한 질문, 선택지 + 직접 입력 병행 (card+input)
3. high (잘 쓰는 학생): 깊이 있는 질문, 직접 입력 위주 (input)

각 수준마다 ${sectionCount}~${sectionCount + 1}개의 질문을 만들어주세요.

[선택지 규칙 - 반드시 준수]
- type이 "card" 또는 "card+input"인 질문의 choices는 반드시 정확히 10개를 만드세요.
- 10개 미만은 절대 안 됩니다. 반드시 10개입니다.
- 학생이 여러 개를 고를 수 있으므로 다양하고 구체적인 보기를 만드세요.
- 비슷한 보기 없이 서로 다른 내용으로 구성하세요.
- type이 "input"인 경우에만 choices를 생략할 수 있습니다.
- 보기 내용은 해당 단계(예: "${sections[0]}", "${sections[sections.length - 1]}")의 성격과 어울려야 합니다.
- [보편성 규칙 - 절대 금지] 선택지는 반드시 모든 학생이 선택할 수 있는 보편적인 내용이어야 합니다.
  · 특정 사람 이름(친구 이름, 가족 이름 등) 금지 → "민준이와" ❌, "친구와" ✅
  · 특정 장소명(우리 학교 이름, 동네 이름 등) 금지 → "한강공원에서" ❌, "공원에서" ✅
  · 특정 학생에게만 해당하는 개인적 상황 금지 → 누구나 고를 수 있는 상황·감정·행동으로 만드세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "low": {
    "questions": [
      {
        "step": 1,
        "question": "질문 내용",
        "type": "card+input",
        "choices": ["보기1", "보기2", "보기3", "보기4", "보기5", "보기6", "보기7", "보기8", "보기9", "보기10"],
        "hint": "힌트 (선택사항)"
      }
    ]
  },
  "mid": {
    "questions": [...]
  },
  "high": {
    "questions": [...]
  }
}

type은 "card"(선택지만), "input"(직접입력만), "card+input"(선택지+직접입력) 중 하나입니다.
card 또는 card+input 타입은 choices가 반드시 10개여야 합니다.
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("GPT 응답이 비어있습니다.");

  return JSON.parse(content) as QuestionSets;
}

export async function generateOutline(
  apiKey: string,
  topic: string,
  topicDescription: string,
  subjectType: SubjectType,
  gradeLevel: GradeLevel,
  outlineDepth: OutlineDepth,
  level: string,
  answers: Answer[]
): Promise<string> {
  const client = createOpenAIClient(apiKey);

  const sectionCount = depthSectionCount(outlineDepth);
  const { philosophy, sections } = getSubjectStructure(subjectType, outlineDepth);
  const gradeDesc = { "저학년": "1~2학년", "중학년": "3~4학년", "고학년": "5~6학년" }[gradeLevel];

  const answersText = answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n");
  const topicContext = topicDescription.trim()
    ? `"${topic}" (${topicDescription.trim()})`
    : `"${topic}"`;

  const isLow = level === "low";

  const sectionSpecText = sections
    .map((title, index) => `${index + 1}. ${title}`)
    .join("\n");

  const exampleSection = sections[0];
  const exampleMiddleSection = sections[Math.floor(sections.length / 2)];

  const lowFormatExample = `✏️ ${exampleSection} | (학생 답변을 반영한 짧고 분명한 한 문장. 핵심 단어가 자연스럽게 들어가야 함.)
(보충 표현 1 / 보충 표현 2 / 보충 표현 3)


✏️ ${exampleMiddleSection} | (학생 답변에서 뽑은 핵심 단어를 살린 짧은 한 문장.)
(보충 표현 1 / 보충 표현 2 / 보충 표현 3)


✏️ ${sections[sections.length - 1]} | (학생 답변에서 뽑은 마무리 핵심을 담은 짧은 한 문장.)
(보충 표현 1 / 보충 표현 2 / 보충 표현 3)
`;

  const midHighFormatExample = `✏️ ${exampleSection} | (학생 답변을 반영한 짧고 분명한 한 문장. 핵심 단어가 자연스럽게 들어가야 함.)


✏️ ${exampleMiddleSection} | (학생 답변에서 뽑은 핵심을 살린 짧은 한 문장.)


✏️ ${sections[sections.length - 1]} | (학생 답변에서 뽑은 마무리 핵심을 담은 짧은 한 문장.)
`;

  const levelConfig = {
    low: {
      sentenceGuide: "주어와 서술어가 분명한 짧은 한 문장(15자 내외). 학생이 답한 표현을 그대로 살려서 쓰세요.",
      extraHintGuide: `- 둘째 줄 괄호 ( ... )에는 그 문장과 어울리는 보충 표현 3개를 ' / '로 구분해 적습니다. 학생이 글을 살을 붙일 때 떠올릴 수 있는 짧은 표현이어야 합니다.
  예) ✏️ 일이 시작된 상황 | 운동장에서 친구와 신나게 축구를 시작했다.
      (쉬는 시간 종이 울리자 / 가장 좋아하는 친구와 / 공이 데굴데굴)`,
    },
    mid: {
      sentenceGuide: "한 문장(20자 내외). 학생 답변을 바탕으로 그 단계의 핵심 내용을 분명히 드러내세요.",
      extraHintGuide: "- 둘째 줄 보충(괄호) 줄은 쓰지 마세요. 한 문장만 출력합니다.",
    },
    high: {
      sentenceGuide: "한 문장(25자 내외). 함축적 표현을 살리되, 그 단계의 핵심이 드러나야 합니다.",
      extraHintGuide: "- 둘째 줄 보충(괄호) 줄은 쓰지 마세요. 한 문장만 출력합니다.",
    },
  }[level as "low" | "mid" | "high"] ?? {
    sentenceGuide: "한 문장(20자 내외). 학생 답변에서 뽑은 핵심을 담아 쓰세요.",
    extraHintGuide: "- 둘째 줄 보충(괄호) 줄은 쓰지 마세요. 한 문장만 출력합니다.",
  };

  const prompt = `
초등학교 ${gradeDesc} 학생이 ${topicContext}을 주제로 "${subjectType}"을 씁니다.
글 종류의 짜임새: ${philosophy}

학생이 답한 내용:
${answersText}

위 학생의 답변을 바탕으로 아래 ${sectionCount}개 단계의 개요를 만들어주세요. 단계 제목은 절대 바꾸지 말고 그대로 사용합니다:
${sectionSpecText}

[작성 규칙 — 반드시 준수]
- 각 단계마다 "✏️ <단계 제목> | <한 문장 요약>" 형식으로 작성합니다.
- 한 문장 요약은 ${levelConfig.sentenceGuide}
- 한 문장 요약은 학생이 답변에서 사용한 핵심 단어를 자연스럽게 포함해야 합니다.
- "키워드만 나열"은 절대 하지 마세요. 반드시 주어+서술어가 있는 짧은 단답식 문장이어야 합니다.
- 단계 제목은 위에 적힌 그대로 사용하고, 순서도 그대로입니다.
- "${subjectType}"의 짜임새에 어울리는 어조로 쓰세요. (예: 편지면 인사·전할 말·끝인사 어조, 주장하는 글이면 단호한 논리 어조)
${levelConfig.extraHintGuide}
- 각 단계 사이에 빈 줄 두 칸을 둡니다.

아래 형식 예시를 그대로 따라주세요:
${isLow ? lowFormatExample : midHighFormatExample}`;

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
  outlineDepth: OutlineDepth,
  level: string,
  answers: Answer[]
): Promise<string> {
  const client = createOpenAIClient(apiKey);

  const levelDesc = { low: "글쓰기가 어려운", mid: "보통 수준의", high: "글을 잘 쓰는" }[level] ?? "보통 수준의";
  const gradeDesc = { "저학년": "1~2학년", "중학년": "3~4학년", "고학년": "5~6학년" }[gradeLevel];
  const paragraphGuide = outlineDepth === "simple"
    ? "2~3문단"
    : outlineDepth === "medium"
      ? "3~4문단"
      : "4문단";

  const { philosophy, sections } = getSubjectStructure(subjectType, outlineDepth);
  const sectionListText = sections.map((title, index) => `${index + 1}. ${title}`).join("\n");

  const answersText = answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n");
  const topicContext = topicDescription.trim()
    ? `"${topic}" (${topicDescription.trim()})`
    : `"${topic}"`;

  const prompt = `
초등학교 ${gradeDesc} ${levelDesc} 학생이 ${topicContext}을 주제로 "${subjectType}"을 씁니다.
글 종류의 짜임새: ${philosophy}

학생이 답한 내용:
${answersText}

이 글은 아래 ${sections.length}단계 흐름을 따릅니다. 문단을 그 흐름에 맞춰 나눠 쓰세요:
${sectionListText}

위 답변을 바탕으로, 학생이 고쳐쓰기 좋도록 ${paragraphGuide}의 짧은 초고를 만들어주세요.

[절대 규칙]
- 완성된 모범답안처럼 너무 매끈하게 쓰지 마세요.
- 학생이 직접 고쳐 쓸 수 있도록 쉬운 표현, 약간은 투박한 흐름을 유지하세요.
- 학생이 답한 말과 표현을 최대한 살리세요.
- 문단은 위 단계 흐름에 맞춰 분명히 나누고, 읽으면 바로 다듬기 좋은 형태로 쓰세요.
- "${subjectType}"의 짜임새에 어울리는 어조와 형식을 지키세요. (예: 편지면 받는 사람·인사말·끝인사가 있어야 하고, 동시면 행이 짧고 운율이 있어야 함.)
- 너무 길게 쓰지 마세요.
- 제목은 쓰지 말고, 문단 글만 작성하세요.
- 불릿, 번호, 이모지는 쓰지 마세요.

출력 형식:
- 문단 글만 출력
- 문단 사이에는 빈 줄 한 줄
`;

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
  - 각 카드 세트당 **최소 3개에서 최대 6개**의 질문을 리스트로 만드세요.
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
            "질문 힌트 3"
          ]
        }
      ]
    }
  ]
}
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0].message.content;
  if (!content) throw new Error("GPT 응답이 비어있습니다.");

  const parsed = JSON.parse(content);
  return (parsed.roles || []) as GeneratedRoleData[];
}

