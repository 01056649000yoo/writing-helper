import type { SubjectType } from "@/types";

export type OutlineTemplateItem = {
  id: string;
  label: string;
  placeholder: string;
};

export type OutlineSection = {
  key: "처음" | "가운데" | "끝";
  items: OutlineTemplateItem[];
};

export type OutlineTemplate = {
  sections: OutlineSection[];
};

const DEFAULT_OUTLINE_TEMPLATES: Record<SubjectType, OutlineTemplate> = {
  "생활문": {
    sections: [
      {
        key: "처음",
        items: [
          { id: "b1", label: "언제, 어디서", placeholder: "예) 지난 토요일 오후, 우리 동네 공원에서..." },
          { id: "b2", label: "그때 나의 상황", placeholder: "예) 친구와 함께 자전거를 타다가..." },
          { id: "b3", label: "시작할 때 기분", placeholder: "예) 날씨가 좋아서 신났는데..." },
        ],
      },
      {
        key: "가운데",
        items: [
          { id: "m1", label: "어떤 일이 있었나요?", placeholder: "예) 갑자기 자전거 바퀴가 펑크가 났어요..." },
          { id: "m2", label: "그 일이 어떻게 이어졌나요?", placeholder: "예) 어떻게 해야 할지 몰라서 당황했는데..." },
          { id: "m3", label: "그때 한 행동이나 말", placeholder: "예) 친구가 도와줘서 같이 자전거 가게를 찾아갔어요..." },
        ],
      },
      {
        key: "끝",
        items: [
          { id: "e1", label: "느낀 점", placeholder: "예) 친구의 도움이 정말 고마웠어요..." },
          { id: "e2", label: "다짐이나 배운 점", placeholder: "예) 앞으로는 자전거를 타기 전에 점검을 꼭 해야겠다고 생각했어요..." },
        ],
      },
    ],
  },

  "일기": {
    sections: [
      {
        key: "처음",
        items: [
          { id: "b1", label: "날씨", placeholder: "예) 맑고 바람이 살살 부는 날이었어요..." },
          { id: "b2", label: "오늘 하루 시작 기분", placeholder: "예) 아침에 일어나니 기분이 좋았어요..." },
        ],
      },
      {
        key: "가운데",
        items: [
          { id: "m1", label: "오늘 있었던 일 ①", placeholder: "예) 학교에서 체육 시간에 피구를 했어요..." },
          { id: "m2", label: "오늘 있었던 일 ②", placeholder: "예) 점심에 급식으로 좋아하는 떡볶이가 나왔어요..." },
          { id: "m3", label: "그때 느낀 감정이나 생각", placeholder: "예) 친구와 같은 팀이 되어서 너무 즐거웠어요..." },
        ],
      },
      {
        key: "끝",
        items: [
          { id: "e1", label: "오늘 하루 돌아보며", placeholder: "예) 오늘은 정말 즐거운 하루였어요..." },
          { id: "e2", label: "내일에 대한 기대나 다짐", placeholder: "예) 내일은 수학 시험이 있는데 열심히 공부해야겠어요..." },
        ],
      },
    ],
  },

  "편지": {
    sections: [
      {
        key: "처음",
        items: [
          { id: "b1", label: "받는 사람", placeholder: "예) 할머니께, 친구 민준이에게, 선생님께..." },
          { id: "b2", label: "인사말과 안부", placeholder: "예) 안녕하세요? 요즘 건강하게 잘 지내고 계신가요?..." },
        ],
      },
      {
        key: "가운데",
        items: [
          { id: "m1", label: "전하고 싶은 말 ①", placeholder: "예) 지난번에 선물해 주신 책이 너무 재미있었어요..." },
          { id: "m2", label: "전하고 싶은 말 ②", placeholder: "예) 저는 요즘 학교에서 그림 그리기 대회를 준비하고 있어요..." },
          { id: "m3", label: "부탁하거나 바라는 것", placeholder: "예) 다음번에 만날 때 같이 공원에 가고 싶어요..." },
        ],
      },
      {
        key: "끝",
        items: [
          { id: "e1", label: "끝인사", placeholder: "예) 건강하게 지내시고 곧 만나요. 안녕히 계세요..." },
          { id: "e2", label: "보내는 날짜와 이름", placeholder: "예) 2025년 5월 20일, 손녀 지은 올림..." },
        ],
      },
    ],
  },

  "독서감상문": {
    sections: [
      {
        key: "처음",
        items: [
          { id: "b1", label: "책 제목과 글쓴이", placeholder: "예) 제목: 강아지똥, 글쓴이: 권정생..." },
          { id: "b2", label: "이 책을 읽게 된 이유", placeholder: "예) 선생님이 추천해 주셔서, 표지가 예뻐서..." },
          { id: "b3", label: "읽기 전 기대나 느낌", placeholder: "예) 제목을 보고 재미있는 이야기일 것 같았어요..." },
        ],
      },
      {
        key: "가운데",
        items: [
          { id: "m1", label: "줄거리 간추리기", placeholder: "예) 강아지똥이 민들레꽃의 거름이 되는 이야기예요..." },
          { id: "m2", label: "인상 깊은 장면이나 인물", placeholder: "예) 강아지똥이 자신이 소중한 존재라는 것을 알게 되는 장면이 감동적이었어요..." },
          { id: "m3", label: "그 장면에서 느낀 점", placeholder: "예) 작은 것도 소중할 수 있다는 것을 느꼈어요..." },
        ],
      },
      {
        key: "끝",
        items: [
          { id: "e1", label: "책 전체를 읽고 난 느낌", placeholder: "예) 이 책을 읽고 나서 마음이 따뜻해졌어요..." },
          { id: "e2", label: "나의 생활과 연결하기", placeholder: "예) 나도 가끔 내가 쓸모없다고 생각했는데, 모두 소중하다는 것을 깨달았어요..." },
        ],
      },
    ],
  },

  "기행문": {
    sections: [
      {
        key: "처음",
        items: [
          { id: "b1", label: "여행지", placeholder: "예) 경주, 제주도, 속리산, 부산..." },
          { id: "b2", label: "여행을 떠난 까닭", placeholder: "예) 가족 여행으로, 현장 체험 학습으로, 친척 집에 가면서..." },
          { id: "b3", label: "함께 간 사람과 교통편", placeholder: "예) 가족 4명이 자동차로 / 친구들과 버스로..." },
          { id: "b4", label: "출발할 때 날씨와 기분", placeholder: "예) 맑고 화창한 날이었고 설레는 마음으로 출발했어요..." },
        ],
      },
      {
        key: "가운데",
        items: [
          { id: "m1", label: "첫 번째 장소에서 본 것·한 일·느낌", placeholder: "예) 불국사에 도착해서 석굴암을 보았는데 정말 웅장했어요..." },
          { id: "m2", label: "두 번째 장소에서 본 것·한 일·느낌", placeholder: "예) 국립경주박물관에서 신라 시대 유물을 봤어요..." },
          { id: "m3", label: "가장 인상 깊었던 경험", placeholder: "예) 처음으로 첨성대를 직접 보았을 때 얼마나 높은지 놀랐어요..." },
        ],
      },
      {
        key: "끝",
        items: [
          { id: "e1", label: "여행을 마치고 든 생각과 느낌", placeholder: "예) 우리나라에 이렇게 멋진 곳이 있다는 것이 자랑스러웠어요..." },
          { id: "e2", label: "기억에 남는 한 가지", placeholder: "예) 온 가족이 함께 별을 본 것이 가장 기억에 남아요..." },
        ],
      },
    ],
  },

  "관찰기록문": {
    sections: [
      {
        key: "처음",
        items: [
          { id: "b1", label: "관찰 대상", placeholder: "예) 개미, 강낭콩 씨앗, 달팽이, 금붕어..." },
          { id: "b2", label: "관찰한 이유", placeholder: "예) 과학 시간에 씨앗이 어떻게 자라는지 궁금해서..." },
          { id: "b3", label: "관찰한 장소와 시간", placeholder: "예) 학교 화단에서 오후 2시에 / 집 어항에서 매일 아침..." },
        ],
      },
      {
        key: "가운데",
        items: [
          { id: "m1", label: "모양과 색깔", placeholder: "예) 개미는 검은색이고 몸이 세 부분으로 나뉘어 있어요..." },
          { id: "m2", label: "움직임이나 소리·냄새", placeholder: "예) 개미는 일렬로 줄을 맞춰 빠르게 움직여요..." },
          { id: "m3", label: "새롭게 발견한 것", placeholder: "예) 개미가 자기 몸무게보다 훨씬 무거운 것도 들 수 있다는 것을 알았어요..." },
        ],
      },
      {
        key: "끝",
        items: [
          { id: "e1", label: "관찰을 통해 알게 된 것", placeholder: "예) 씨앗이 물과 햇빛이 있어야 싹이 튼다는 것을 직접 확인했어요..." },
          { id: "e2", label: "더 궁금한 점", placeholder: "예) 개미는 집을 어떻게 만드는지 더 자세히 알아보고 싶어요..." },
        ],
      },
    ],
  },

  "이야기 글": {
    sections: [
      {
        key: "처음",
        items: [
          { id: "b1", label: "이야기의 배경", placeholder: "예) 옛날 어느 산 속 마을에서 / 미래의 우주 정거장에서..." },
          { id: "b2", label: "주인공 소개", placeholder: "예) 용감하지만 겁이 많은 열 살짜리 소녀 지혜..." },
          { id: "b3", label: "이야기가 시작되는 상황", placeholder: "예) 어느 날 지혜는 숲 속에서 이상한 문을 발견했어요..." },
        ],
      },
      {
        key: "가운데",
        items: [
          { id: "m1", label: "어떤 일(사건)이 일어났나요?", placeholder: "예) 문을 열고 들어갔더니 이상한 나라가 펼쳐졌어요..." },
          { id: "m2", label: "주인공이 어떻게 해결하려 했나요?", placeholder: "예) 지혜는 그곳에서 만난 요정의 도움을 받기로 했어요..." },
          { id: "m3", label: "위기나 고비", placeholder: "예) 집으로 돌아가는 길을 찾다가 악당을 만났어요..." },
        ],
      },
      {
        key: "끝",
        items: [
          { id: "e1", label: "사건이 어떻게 끝났나요?", placeholder: "예) 용기를 내어 악당을 물리치고 무사히 집으로 돌아왔어요..." },
          { id: "e2", label: "주인공의 변화나 깨달음", placeholder: "예) 지혜는 두려워도 용기를 내면 할 수 있다는 것을 알게 됐어요..." },
        ],
      },
    ],
  },

  "설명하는 글": {
    sections: [
      {
        key: "처음",
        items: [
          { id: "b1", label: "설명할 대상", placeholder: "예) 태양계, 재활용 방법, 사계절이 생기는 이유..." },
          { id: "b2", label: "설명하려는 이유", placeholder: "예) 많은 사람들이 재활용을 어떻게 해야 하는지 잘 모르기 때문이에요..." },
        ],
      },
      {
        key: "가운데",
        items: [
          { id: "m1", label: "첫 번째 특징이나 방법", placeholder: "예) 태양계는 태양을 중심으로 8개의 행성이 돌고 있어요..." },
          { id: "m2", label: "두 번째 특징이나 방법", placeholder: "예) 지구는 태양에서 세 번째로 가까운 행성이에요..." },
          { id: "m3", label: "예를 들어 설명하기", placeholder: "예) 태양계를 운동장이라고 생각하면, 태양은 가운데 있는 큰 공이에요..." },
        ],
      },
      {
        key: "끝",
        items: [
          { id: "e1", label: "정리 한 문장", placeholder: "예) 태양계는 태양과 그 주변을 도는 행성들이 이루는 거대한 가족이에요..." },
          { id: "e2", label: "더 알면 좋은 점", placeholder: "예) 재활용을 잘 하면 지구 환경을 지키는 데 큰 도움이 돼요..." },
        ],
      },
    ],
  },

  "주장하는 글": {
    sections: [
      {
        key: "처음",
        items: [
          { id: "b1", label: "문제 상황", placeholder: "예) 요즘 학생들이 스마트폰을 너무 오래 사용하는 문제..." },
          { id: "b2", label: "나의 주장", placeholder: "예) 학생들은 하루 스마트폰 사용 시간을 정해야 한다고 생각합니다..." },
        ],
      },
      {
        key: "가운데",
        items: [
          { id: "m1", label: "근거 ① (첫 번째 이유)", placeholder: "예) 스마트폰을 오래 사용하면 눈 건강이 나빠지기 때문이에요..." },
          { id: "m2", label: "근거 ② (두 번째 이유)", placeholder: "예) 또한 잠을 충분히 자지 못해 공부에 집중하기 어려워져요..." },
          { id: "m3", label: "반대 의견에 대한 내 생각", placeholder: "예) 스마트폰으로 공부에 도움이 된다는 의견도 있지만, 공부 시간에는 집중이 더 중요해요..." },
        ],
      },
      {
        key: "끝",
        items: [
          { id: "e1", label: "주장 다시 강조", placeholder: "예) 따라서 학생들은 스마트폰 사용 시간을 스스로 조절하는 것이 필요합니다..." },
          { id: "e2", label: "독자에게 실천 호소", placeholder: "예) 지금 당장 하루 사용 시간을 정해 보세요. 작은 실천이 큰 변화를 만들어요..." },
        ],
      },
    ],
  },

  "소개하는 글": {
    sections: [
      {
        key: "처음",
        items: [
          { id: "b1", label: "소개할 대상", placeholder: "예) 우리 강아지 콩이, 좋아하는 책, 우리 동네 도서관..." },
          { id: "b2", label: "소개하는 이유", placeholder: "예) 우리 강아지가 너무 귀엽고 특별한 재주가 있어서요..." },
        ],
      },
      {
        key: "가운데",
        items: [
          { id: "m1", label: "겉모습이나 첫 번째 특징", placeholder: "예) 콩이는 갈색 털을 가진 작은 강아지예요. 귀가 쫑긋해서 더 귀여워요..." },
          { id: "m2", label: "성격·기능·장점", placeholder: "예) 성격이 매우 활발하고 처음 보는 사람에게도 친근하게 다가와요..." },
          { id: "m3", label: "재미있거나 특별한 점", placeholder: "예) 콩이는 이름을 부르면 반드시 한 바퀴를 돌고 와요. 이것이 콩이만의 인사예요..." },
        ],
      },
      {
        key: "끝",
        items: [
          { id: "e1", label: "추천하는 한 마디", placeholder: "예) 강아지를 키우고 싶다면 콩이처럼 활발한 강아지를 추천해요..." },
          { id: "e2", label: "마무리 소감", placeholder: "예) 여러분도 소중한 사람이나 것을 소개해 보는 건 어떨까요?..." },
        ],
      },
    ],
  },

  "동시": {
    sections: [
      {
        key: "처음",
        items: [
          { id: "b1", label: "시의 소재", placeholder: "예) 비 오는 날, 내 강아지, 봄꽃, 할머니의 손..." },
          { id: "b2", label: "소재를 선택한 이유나 느낌", placeholder: "예) 비 오는 날 창문에 맺히는 빗방울이 눈물 같아서..." },
        ],
      },
      {
        key: "가운데",
        items: [
          { id: "m1", label: "비유로 표현하기", placeholder: "예) 빗방울은 창문을 타고 내려오는 눈물 같아요 / 강아지 발바닥은 작은 꽃잎 같아요..." },
          { id: "m2", label: "반복하거나 리듬 있는 표현", placeholder: "예) 톡, 톡, 톡 / 데굴데굴 굴러가는 / 한 방울, 두 방울..." },
        ],
      },
      {
        key: "끝",
        items: [
          { id: "e1", label: "시를 마무리하는 느낌", placeholder: "예) 빗소리를 들으면 나는 오늘도 창문 앞에 앉아요... / 그래서 나는 강아지가 좋아요..." },
        ],
      },
    ],
  },

  "보고서": {
    sections: [
      {
        key: "처음",
        items: [
          { id: "b1", label: "조사 주제", placeholder: "예) 우리 동네 쓰레기 분리배출 현황, 식물이 빛에 따라 자라는 모습..." },
          { id: "b2", label: "주제를 선택한 이유", placeholder: "예) 우리 반 친구들이 어떤 것을 좋아하는지 궁금해서 조사했어요..." },
        ],
      },
      {
        key: "가운데",
        items: [
          { id: "m1", label: "조사 방법", placeholder: "예) 설문지를 만들어 반 친구 25명에게 물어봤어요 / 직접 관찰하고 기록했어요..." },
          { id: "m2", label: "조사 결과 ①", placeholder: "예) 조사 결과, 반 친구들이 가장 좋아하는 계절은 여름이었어요 (12명)..." },
          { id: "m3", label: "조사 결과 ②", placeholder: "예) 두 번째로 많은 것은 봄이었고, 겨울을 좋아하는 친구는 3명이었어요..." },
        ],
      },
      {
        key: "끝",
        items: [
          { id: "e1", label: "결론", placeholder: "예) 우리 반 친구들은 더운 여름을 가장 좋아하며, 방학이 있어서 그런 것 같아요..." },
          { id: "e2", label: "느낀 점과 더 알고 싶은 것", placeholder: "예) 직접 조사하니 예상과 다른 결과가 나와서 신기했어요. 다음엔 더 많은 사람을 조사해 보고 싶어요..." },
        ],
      },
    ],
  },
};

export function getDefaultOutlineTemplate(subjectType: SubjectType): OutlineTemplate {
  return DEFAULT_OUTLINE_TEMPLATES[subjectType];
}

export function getEffectiveTemplate(
  subjectType: SubjectType,
  customTemplate: OutlineTemplate | null | undefined,
): OutlineTemplate {
  return customTemplate ?? getDefaultOutlineTemplate(subjectType);
}
