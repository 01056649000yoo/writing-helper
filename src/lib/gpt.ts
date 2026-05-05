import OpenAI from "openai";
import type { QuestionSets, SubjectType, GradeLevel, OutlineDepth, Answer } from "@/types";

export function createOpenAIClient(apiKey: string) {
  return new OpenAI({ apiKey });
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

  const depthDesc = outlineDepth === "simple"
    ? "처음/중간/끝 (3단계, 단계별 1~2문장)"
    : outlineDepth === "medium"
    ? "처음/중간1/중간2/끝 (4단계, 단계별 2~3문장)"
    : "처음/중간1/중간2/중간3/끝 (5단계, 단계별 3~4문장)";
  const gradeDesc = {
    "저학년": "초등학교 1~2학년 (매우 쉬운 단어, 짧은 문장)",
    "중학년": "초등학교 3~4학년 (쉬운 단어, 보통 문장)",
    "고학년": "초등학교 5~6학년 (다양한 어휘, 깊이 있는 사고)",
  }[gradeLevel];

  const subjectGuide: Record<string, string> = {
    "생활문": "실제 경험한 일을 구체적으로 표현하는",
    "일기": "하루 있었던 일과 느낌을 솔직하게 쓰는",
    "편지": "받는 사람을 생각하며 마음을 전하는",
    "독서감상문": "읽은 책의 내용과 느낌, 생각을 쓰는",
    "기행문": "여행하며 보고 듣고 느낀 것을 쓰는",
    "관찰기록문": "관찰한 대상의 특징과 변화를 기록하는",
    "이야기 글": "상상력을 발휘해 인물·사건·배경이 있는",
    "설명하는 글": "대상의 특징이나 방법을 정확하게 설명하는",
    "주장하는 글": "자신의 의견과 근거를 논리적으로 펼치는",
    "소개하는 글": "인물·장소·물건 등의 특징을 알리는",
    "동시": "리듬과 비유로 감정과 상상을 표현하는",
    "보고서": "조사하거나 실험한 내용을 체계적으로 정리하는",
  };
  const subjectDesc = subjectGuide[subjectType] ?? subjectType;

  const topicSection = topicDescription.trim()
    ? `- 글 주제: ${topic}\n- 주제 부연 설명: ${topicDescription.trim()}`
    : `- 글 주제: ${topic}`;

  const prompt = `
초등학생 글쓰기 교육 전문가로서 아래 조건에 맞는 글쓰기 도움 질문 세트를 만들어주세요.

조건:
${topicSection}
- 글 종류: ${subjectType} (${subjectDesc} 글)
- 대상: ${gradeDesc}
- 개요 구조: ${depthDesc}

3가지 수준별 질문 세트를 만들어주세요:
1. low (글쓰기가 어려운 학생): 매우 구체적이고 단순한 질문, 선택지 카드 위주
2. mid (보통 학생): 적당한 질문, 선택지 + 직접 입력 병행
3. high (잘 쓰는 학생): 깊이 있는 질문, 직접 입력 위주

각 수준마다 ${outlineDepth === "simple" ? "3~4" : "4~5"}개의 질문을 만들어주세요.

[선택지 규칙 - 반드시 준수]
- type이 "card" 또는 "card+input"인 질문의 choices는 반드시 정확히 10개를 만드세요.
- 10개 미만은 절대 안 됩니다. 반드시 10개입니다.
- 학생이 여러 개를 고를 수 있으므로 다양하고 구체적인 보기를 만드세요.
- 비슷한 보기 없이 서로 다른 내용으로 구성하세요.
- type이 "input"인 경우에만 choices를 생략할 수 있습니다.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "low": {
    "questions": [
      {
        "step": 1,
        "question": "질문 내용",
        "type": "card",
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

  const levelDesc = { low: "글쓰기가 어려운", mid: "보통 수준의", high: "글을 잘 쓰는" }[level] ?? "보통 수준의";
  const depthDesc = outlineDepth === "simple"
    ? "처음/중간/끝 (3단계, 단계별 1~2문장)"
    : outlineDepth === "medium"
    ? "처음/중간1/중간2/끝 (4단계, 단계별 2~3문장)"
    : "처음/중간1/중간2/중간3/끝 (5단계, 단계별 3~4문장)";
  const gradeDesc = { "저학년": "1~2학년", "중학년": "3~4학년", "고학년": "5~6학년" }[gradeLevel];

  const answersText = answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n");
  const topicContext = topicDescription.trim()
    ? `"${topic}" (${topicDescription.trim()})`
    : `"${topic}"`;

  const prompt = `
초등학교 ${gradeDesc} ${levelDesc} 학생이 ${topicContext}을 주제로 ${subjectType}을 씁니다.

학생이 답한 내용:
${answersText}

위 내용을 바탕으로 ${depthDesc} 구조의 글쓰기 개요를 만들어주세요.

[절대 규칙]
- 완성된 문장으로 쓰지 마세요. 개요는 글을 쓰기 위한 메모이지 글 자체가 아닙니다.
- 각 항목은 "~했다", "~이다" 같은 서술형 종결 문장이 되면 안 됩니다.
- 반드시 짧은 구(句), 키워드, 명사형 표현으로만 작성하세요.
  예) ❌ "친구들과 함께 공을 차며 즐거운 시간을 보냈다."
      ✅ "• 친구들과 공차기 → 웃음, 땀"
- 각 단계마다 불릿(•)으로 3~5개 항목을 나열하세요.
- 학생이 이 개요를 보고 스스로 문장을 완성할 수 있도록 핵심 단어와 방향만 제시하세요.
- ${gradeDesc} 수준에 맞는 쉬운 단어 사용
- 학생이 답한 내용을 최대한 반영

아래 형식으로 작성해주세요 (단계 수는 ${depthDesc}에 맞게):
📝 처음
• (키워드/구)
• (키워드/구)
• (키워드/구)

📝 중간
• (키워드/구)
• (키워드/구)
• (키워드/구)

📝 끝
• (키워드/구)
• (키워드/구)
`;

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

  const answersText = answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n");
  const topicContext = topicDescription.trim()
    ? `"${topic}" (${topicDescription.trim()})`
    : `"${topic}"`;

  const prompt = `
초등학교 ${gradeDesc} ${levelDesc} 학생이 ${topicContext}을 주제로 ${subjectType}을 씁니다.

학생이 답한 내용:
${answersText}

위 답변을 바탕으로, 학생이 고쳐쓰기 좋도록 ${paragraphGuide}의 짧은 초고를 만들어주세요.

[절대 규칙]
- 완성된 모범답안처럼 너무 매끈하게 쓰지 마세요.
- 학생이 직접 고쳐 쓸 수 있도록 쉬운 표현, 약간은 투박한 흐름을 유지하세요.
- 학생이 답한 말과 표현을 최대한 살리세요.
- 문단은 분명히 나누고, 읽으면 바로 다듬기 좋은 형태로 쓰세요.
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
