# 질문 평가 플러그인 설계안

## 목적

이 플러그인의 목적은 `질문 만들기(question_generator)` 활동에서 학생들이 만든 질문을 다음 차시에 다시 불러와,
학생들이 익명으로 질문을 읽고 `좋은 질문의 기준`에 따라 평가하도록 만드는 것입니다.

즉 수업 흐름은 아래처럼 이어집니다.

1. 학생이 질문을 만든다.
2. 교사가 질문 결과를 바탕으로 `좋은 질문 고르기` 세션을 연다.
3. 학생은 익명 질문 목록을 읽고, 좋은 질문 기준에 따라 평가한다.
4. 교사가 활동을 종료하면 득표/평가 결과를 본다.

이 구조는 기존 `question_voting` 플러그인을 확장하는 방식이 가장 적합합니다.

## 추천 결론

### 새 플러그인 추가보다 `question_voting` 확장 권장

이유:

- 이미 `question_voting`라는 개념이 프로젝트에 존재한다.
- 학생이 질문 후보를 읽고 선택하는 기본 뼈대가 현재 의도와 가깝다.
- `question_generator -> question_voting` 흐름으로 묶으면 활동 라이브러리 구조가 깔끔하다.
- 기존 라우트, draft 저장, activity registry와도 충돌이 적다.

따라서 추천 방향은:

- `question_voting`를 단순 후보 선택형 활동에서
- `질문 만들기 결과를 소스로 쓰는 질문 평가형 활동`
로 진화시키는 것입니다.

## 핵심 개념

### 1. 질문 소스 세션

평가 활동은 독립적으로 질문을 입력받지 않고,
이전 `question_generator` 세션의 결과를 `source`로 참조해야 합니다.

필수 필드:

- `sourceRoomId`
- `sourceQuestions`

여기서 `sourceQuestions`는 세션 생성 시 snapshot으로 저장하는 것이 중요합니다.

이유:

- 원본 질문 만들기 세션이 나중에 바뀌어도 평가 세션은 안정적으로 유지되어야 함
- 학생이 질문을 다시 수정해도 이미 열린 평가 세션은 흔들리지 않아야 함

## 추천 config 구조

현재 `QuestionVotingConfig`를 아래처럼 확장하는 것을 권장합니다.

```ts
export type QuestionVotingConfig = {
  sourceRoomId: string | null;
  sourceQuestions: Array<{
    id: string;
    text: string;
  }>;
  evaluationCriteria: string[];
  maxSelections: number;
  requireReason: boolean;
};
```

설명:

- `sourceRoomId`
  어떤 질문 만들기 활동 결과를 가져왔는지

- `sourceQuestions`
  익명 질문 snapshot

- `evaluationCriteria`
  교사가 제시한 좋은 질문 기준

- `maxSelections`
  학생당 몇 개까지 좋은 질문으로 고를 수 있는지

- `requireReason`
  선택 이유를 적게 할지 여부

## 추천 submission 구조

```ts
export type QuestionVotingSubmission = {
  selectedQuestionIds: string[];
  reason?: string;
};
```

처음 버전은 이 정도면 충분합니다.

향후 확장 가능:

- 질문별 점수화
- 기준별 평가
- 다중 선택 + 우선순위 선택

## 추천 room result 구조

```ts
export type QuestionVotingRoomResult = {
  ranking: Array<{
    questionId: string;
    text: string;
    votes: number;
    reasons: string[];
  }>;
};
```

이 구조면 교사 결과 화면에서:

- 득표 순 정렬
- 질문 텍스트 확인
- 학생들이 남긴 이유 보기

가 가능합니다.

## 교사 화면 설계

파일 기준:

- `src/app/dashboard/room/new/page.tsx`

현재 `question_voting` 생성 화면은 교사가 질문 후보를 직접 여러 줄로 입력하는 구조입니다.
이걸 아래 흐름으로 바꾸는 것이 좋습니다.

### 새 생성 흐름

1. 질문 출처 선택
2. 질문 후보 확인
3. 좋은 질문 기준 입력
4. 학생당 선택 개수 설정
5. 이유 작성 여부 설정
6. 세션 시작

### 1. 질문 출처 선택

교사가 최근 `question_generator` 세션 목록을 볼 수 있어야 합니다.

예시 표시 항목:

- 활동 제목
- 주제
- 생성 시각
- 질문 개수

추천 액션 이름:

- `getQuestionGeneratorSourceRooms()`

### 2. 질문 후보 확인

선택한 sourceRoom의 질문들을 익명 목록으로 확인합니다.

UI 예:

- `질문 1`
- `질문 2`
- ...

교사가 필요하면 일부만 평가 후보로 선택하는 구조도 확장 가능합니다.

초기 버전은 전체 사용 추천.

### 3. 좋은 질문 기준 입력

교사가 한 줄씩 입력:

- 여러 가지 생각이 나오는 질문
- 답이 하나로 끝나지 않는 질문
- 친구가 더 말해보고 싶어지는 질문
- 이야기와 잘 연결된 질문

추천 구조:

```ts
evaluationCriteria: string[]
```

### 4. 학생당 선택 개수

보통:

- 1개
- 2개
- 3개

### 5. 이유 작성 여부

- 켜짐: 왜 좋은 질문인지 한 줄 작성
- 꺼짐: 선택만

## 학생 화면 설계

파일 기준:

- `src/app/room/[id]/activity/page.tsx`

현재 `question_voting` 학생 화면은 placeholder 상태입니다.
이 부분을 실제 평가 화면으로 구현해야 합니다.

### 학생 흐름

1. 좋은 질문 기준 읽기
2. 익명 질문 목록 보기
3. 좋은 질문 선택
4. 필요하면 이유 쓰기
5. 제출

### 화면 구조

#### 상단

- 오늘 활동 제목
- 좋은 질문 기준 카드
- 선택 진행 상태

#### 본문

익명 질문 카드 목록:

- 질문 텍스트
- 선택 버튼
- 선택 시 강조

#### 하단

- 남은 선택 수
- 이유 입력칸
- 제출 버튼

### 중요 UX 포인트

- 질문 작성자 정보는 절대 노출하지 않음
- 학생은 질문 텍스트만 보고 평가
- 아직 제출하지 않은 학생도 질문은 읽을 수 있게 할지 여부는 정책으로 결정 가능

추천:

- 이 활동은 평가 활동이므로 입장 즉시 익명 질문 열람 가능

## 교사 결과 화면 설계

파일 기준:

- `src/app/dashboard/room/[id]/page.tsx`
- `src/app/dashboard/room/[id]/result/[sessionId]/page.tsx`

추천은 `room detail` 화면에서 결과 모달 또는 요약 패널을 보여주는 방식입니다.

### 보여줄 내용

- 질문 순위
- 질문 텍스트
- 득표 수
- 이유 보기

예:

1위 질문
- 질문: ...
- 득표: 14표
- 이유 6개

### 추가 기능

- 활동 종료 전에는 중간 집계 숨김 가능
- 교사 종료 후 최종 결과 공개

추천 필드:

- `rooms.activity_state.revealResults`
- 또는 `rooms.is_active = false`일 때만 최종 결과 강조

## 서버 액션 설계

### room-actions.ts

추가 추천:

- `getQuestionGeneratorSourceRooms(classId?: string)`
- `getQuestionGeneratorSourceQuestions(roomId: string)`
- `getQuestionVotingRoomResults(roomId: string)`

### student-actions.ts

추가 추천:

- `submitQuestionVoting(sessionId, roomId, submission)`
- `getStudentQuestionVotingData(sessionId, roomId)`

## 현재 파일 기준 변경 포인트

### 1. `src/features/activities/types.ts`

현재 `QuestionVotingConfig` / `QuestionVotingRoomResult` 확장

### 2. `src/features/activities/question-voting/definition.ts`

현재 direct input형 정의를 source-based 평가형으로 변경

### 3. `src/app/dashboard/room/new/page.tsx`

현재 `question_voting` 생성 UI를

- 질문 후보 직접 입력
에서
- 질문 만들기 결과 선택

방식으로 변경

### 4. `src/app/actions/room-actions.ts`

source question 조회 액션 추가

### 5. `src/app/room/[id]/activity/page.tsx`

학생용 실제 평가 화면 구현

### 6. `src/app/dashboard/room/[id]/page.tsx`

교사용 집계 보기 버튼 추가 가능

## 단계별 구현 순서 추천

### Phase 1

`question_voting`를 source-based 활동으로 재정의

- sourceRoomId 저장
- sourceQuestions snapshot 저장
- 교사 생성 UI 변경

### Phase 2

학생용 질문 평가 화면 구현

- 기준 읽기
- 질문 선택
- 이유 제출

### Phase 3

교사용 결과 집계 화면 구현

- 순위
- 득표
- 이유

### Phase 4

질문 만들기 결과 화면과 자연스럽게 연결

예:

- 교사 질문 만들기 결과 화면에서
  `이 질문들로 좋은 질문 고르기 시작` 버튼 제공

## 추천 요약

이 기능은 새 플러그인을 추가하는 것보다
기존 `question_voting`를 다음처럼 확장하는 것이 가장 좋습니다.

- 입력: 이전 `question_generator` 결과
- 처리: 익명 질문 평가
- 출력: 좋은 질문 순위

즉 이 앱 흐름은 이렇게 정리됩니다.

1. 질문 만들기
2. 좋은 질문 고르기
3. 글 개요 짜기

이렇게 되면 활동 간 연결성이 아주 좋아집니다.
