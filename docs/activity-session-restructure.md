# 활동 세션 중심 재구조화 설계도

이 문서는 이 앱의 실제 목적에 맞춰 구조를 다시 정의합니다.

- 교사가 활동을 연다
- 학생은 복잡한 로그인 없이 바로 들어온다
- 활동 유형은 계속 추가된다
- 결과는 누적되어 다음 수업에도 다시 활용된다

즉 이 앱은 `학급 관리 앱`이나 `학생 계정 시스템`이 아니라,  
`교사가 운영하는 활동 세션 플랫폼`으로 보는 것이 가장 정확합니다.

## 1. 제품 정의

이 앱이 사용자에게 꾸준히 약속해야 하는 경험은 아래와 같습니다.

1. 교사는 한 번 로그인한다.
2. 교사는 원하는 활동 세션을 연다.
3. 학생은 쉬운 방식으로 입장한다.
4. 학생은 선택된 활동 포맷에 맞게 참여한다.
5. 교사는 결과를 보고 다시 활용한다.

여기서 구조의 중심은 `room`도 아니고 `학생 계정`도 아닙니다.  
중심은 `활동 세션(activity session)`입니다.

## 2. 권장 도메인 모델

### 핵심 엔티티

`teacher`

- 로그인하는 교사
- 참여자 그룹, 활동, 결과를 관리하는 주체

`participant_group`

- 학생 확인을 돕는 참여자 명단 묶음
- 보통은 학급이지만 구조적으로는 이름 있는 명단 그룹

`participant`

- 참여자 그룹 안의 학생 한 명
- 보통 `번호 + 이름`

`activity_template`

- 반복해서 사용할 수 있는 활동 유형
- 예: `outline_builder`, `exit_ticket_writer`, `question_generator`

`activity_session`

- 교사가 실제로 한 번 연 활동
- 학생이 입장하는 대상
- 현재 `room`이 개념적으로 여기에 해당

`participant_session`

- 학생 한 명이 특정 활동 세션에 참여한 기록

`activity_result`

- 학생별 결과와 반 전체 결과

`activity_event`

- 질문 제출, 투표, 선택, 진행 상태 같은 이벤트 기록
- 집계와 분석에 유용

## 3. 용어 전환 방향

현재 `room`이라는 이름도 기술적으로는 동작하지만, 제품 개념으로는 `activity_session`이 더 정확합니다.

권장 용어 전환:

- `class` -> `participant_group`
- `class_student` -> `participant`
- `room` -> `activity_session`
- `student_session` -> `participant_session`

DB 테이블 이름을 당장 모두 바꿀 필요는 없습니다.  
1차 목표는 코드와 UI에서 먼저 개념을 바로잡는 것입니다.

## 4. 구조 원칙

앱은 아래 3층으로 나누는 것이 좋습니다.

### 4-1. 세션 엔진

모든 활동이 공통으로 쓰는 실행 엔진입니다.

- 세션 열기
- 세션 닫기
- 세션 입장
- 참여자 확인
- 진행 상황 저장
- 제출 완료 처리
- 결과 수집

### 4-2. 활동 포맷 플러그인

각 활동 포맷은 아래 요소를 가집니다.

- 교사 설정 화면
- 학생 활동 화면
- 제출 데이터 구조
- 결과 데이터 구조
- 교사용 결과 화면

### 4-3. 교사 작업 공간

로그인한 교사가 쓰는 관리 화면입니다.

- 참여자 그룹 관리
- 활동 세션 시작
- 실시간 참여 모니터링
- 결과 열람
- 이전 결과 재활용

## 5. 권장 앱 구조

```txt
src/
  app/
    dashboard/
      page.tsx
      groups/
      sessions/
      results/
      settings/
    join/
      [sessionId]/
        page.tsx
        activity/page.tsx
        done/page.tsx
    share/
    api/

  features/
    session-engine/
      actions.ts
      queries.ts
      service.ts
      types.ts
    participant-groups/
      actions.ts
      queries.ts
      service.ts
      types.ts
    activities/
      registry.ts
      types.ts
      outline-builder/
      exit-ticket-writer/
      question-generator/
      question-voting/
    results/
      queries.ts
      service.ts
    auth/
    settings/

  shared/
    db/
    ai/
    types/
    utils/
```

## 6. 권장 라우트 구조

### 교사용 라우트

`/dashboard`

- 최근 활동 세션
- 최근 결과
- 빠른 시작

`/dashboard/groups`

- 참여자 그룹 목록

`/dashboard/groups/new`

- 새 학급 또는 명단 그룹 만들기

`/dashboard/groups/[id]`

- 참여자 그룹 상세
- 학생 목록
- 최근 세션

`/dashboard/sessions/new`

- 활동 포맷 선택
- 입장 방식 선택
- 참여자 그룹 선택 또는 자유 입장 선택

`/dashboard/sessions/[sessionId]`

- 실시간 현황
- 참여 링크 / QR
- 학생 진행 상태 확인

`/dashboard/results`

- 누적 결과 보관함

### 학생용 라우트

`/join/[sessionId]`

- 가벼운 입장 및 확인

`/join/[sessionId]/activity`

- 활동 포맷별 학생 화면

`/join/[sessionId]/done`

- 완료 또는 결과 확인

현재의 `room` 기반 이름보다 `join` 기반 이름이 학생 경험과 제품 목적을 더 잘 드러냅니다.

## 7. 입장과 확인 방식

학생에게는 정식 계정을 요구하지 않는 것이 맞습니다.

권장 입장 정책:

- `group_name_number`
  명단 기반 번호 + 이름 확인
- `group_name_number_code`
  번호 + 이름 + 짧은 세션 코드
- `nickname_only`
  부담 없는 자유 입장
- `nickname_plus_code`
  닉네임 + 교사가 알려준 코드

즉 참여자 그룹은 유용하지만 필수는 아닙니다.

## 8. 데이터 모델 권장안

개념 모델 예시는 아래와 같습니다.

`participant_groups`

- `id`
- `teacher_id`
- `name`
- `group_type`
- `created_at`

`participants`

- `id`
- `participant_group_id`
- `display_number`
- `display_name`
- `created_at`

`activity_sessions`

- `id`
- `teacher_id`
- `participant_group_id`
- `activity_type`
- `title`
- `topic`
- `topic_description`
- `join_policy`
- `join_code`
- `activity_config`
- `activity_state`
- `status`
- `opened_at`
- `expires_at`
- `teacher_last_seen_at`
- `closed_at`

`participant_sessions`

- `id`
- `activity_session_id`
- `participant_id`
- `display_number`
- `display_name`
- `status`
- `progress_step`
- `progress_index`
- `submission`
- `result`
- `created_at`
- `updated_at`

`activity_events`

- `id`
- `activity_session_id`
- `participant_session_id`
- `event_type`
- `payload`
- `created_at`

## 9. 현재 구조에서 미래 구조로의 매핑

### 개념 매핑

현재 `Class`

- 미래 역할: `participant_group`

현재 `ClassStudent`

- 미래 역할: `participant`

현재 `Room`

- 미래 역할: `activity_session`

현재 `StudentSession`

- 미래 역할: `participant_session`

현재 `OutlineQueue`

- 미래 역할: `outline_builder` 전용 비동기 작업 큐

### 파일 매핑

현재 [src/app/actions/class-actions.ts](/Users/seunghyeonmaegmini/writing-helper/src/app/actions/class-actions.ts:1)

- 앞으로 `features/participant-groups/actions.ts` 방향으로 이동

현재 [src/app/actions/room-actions.ts](/Users/seunghyeonmaegmini/writing-helper/src/app/actions/room-actions.ts:1)

- 아래로 분리
- `features/session-engine/actions.ts`
- `features/session-engine/queries.ts`
- `features/activities/*` 내부의 포맷별 세션 생성 보조 로직

현재 [src/app/actions/student-actions.ts](/Users/seunghyeonmaegmini/writing-helper/src/app/actions/student-actions.ts:1)

- 아래로 분리
- `features/session-engine/actions.ts`
- `features/results/service.ts`
- `features/activities/outline-builder/*`

현재 [src/app/dashboard/class/new/page.tsx](/Users/seunghyeonmaegmini/writing-helper/src/app/dashboard/class/new/page.tsx:1)

- `/dashboard/groups/new`에 해당

현재 [src/app/dashboard/class/[id]/page.tsx](/Users/seunghyeonmaegmini/writing-helper/src/app/dashboard/class/[id]/page.tsx:1)

- `/dashboard/groups/[id]`에 해당
- 학생 목록, 최근 세션, 빠른 시작 중심으로 강화

현재 [src/app/dashboard/room/new/page.tsx](/Users/seunghyeonmaegmini/writing-helper/src/app/dashboard/room/new/page.tsx:1)

- `/dashboard/sessions/new`에 해당
- 더 이상 개요 짜기 전용 화면이면 안 됨
- `activity_template + join_policy + participant_group`를 선택해야 함

현재 [src/app/dashboard/room/[id]/page.tsx](/Users/seunghyeonmaegmini/writing-helper/src/app/dashboard/room/[id]/page.tsx:1)

- `/dashboard/sessions/[sessionId]`에 해당

현재 [src/app/room/[id]/page.tsx](/Users/seunghyeonmaegmini/writing-helper/src/app/room/[id]/page.tsx:1)

- `/join/[sessionId]`에 해당

현재 [src/app/room/[id]/activity/page.tsx](/Users/seunghyeonmaegmini/writing-helper/src/app/room/[id]/activity/page.tsx:1)

- `/join/[sessionId]/activity`에 해당
- 내부에서 `activityRegistry`를 통해 포맷별 화면을 연결해야 함

현재 [src/app/room/[id]/waiting/page.tsx](/Users/seunghyeonmaegmini/writing-helper/src/app/room/[id]/waiting/page.tsx:1)

- 공통 비동기 결과 화면 또는 포맷별 대기 흐름으로 재배치

현재 [src/app/room/[id]/result/page.tsx](/Users/seunghyeonmaegmini/writing-helper/src/app/room/[id]/result/page.tsx:1)

- `/join/[sessionId]/done`에 해당

현재 [src/features/activities](/Users/seunghyeonmaegmini/writing-helper/src/features/activities)

- 이미 방향은 맞음
- 앞으로 활동 포맷 전용 로직의 핵심 위치가 되어야 함

## 10. 그대로 살려야 할 점

현재 구조에서 좋은 부분은 유지하는 게 맞습니다.

- 교사 계정 로그인
- 명단 기반 학생 확인
- 활동 결과 저장과 누적
- `activity_type`와 `activity_config`
- `activity_events`
- 교사가 직접 활동을 열고 닫는 운영 모델

## 11. 빨리 바꾸면 좋은 점

### 11-1. 학급 중심에서 세션 시작 중심으로 이동

학급은 세션을 돕는 자원이지, 앱의 주인공이 아닙니다.

### 11-2. 학생 라우트를 `room`에서 `join` 의미로 전환

교사와 개발자 모두에게 제품 목적이 더 분명해집니다.

### 11-3. `outline_builder`를 진짜 플러그인으로 분리

지금은 아직 기본 동작과 너무 강하게 묶여 있습니다.

### 11-4. 입장 정책을 세션의 1급 속성으로 승격

`번호+이름`, `번호+이름+코드`, `닉네임만` 같은 정책이 세션 자체의 성격이 되어야 합니다.

### 11-5. 다음 활동 포맷을 가볍게 하나 추가

추천 포맷:

`exit_ticket_writer`

이유:

- UI가 단순함
- 구현 리스크가 낮음
- 실제 수업 재사용성이 큼
- 플러그인 구조 검증에 적합함

## 12. 단계별 리팩터링 계획

### Phase 1

- 기존 테이블 이름은 유지
- 코드와 UI에서 개념을 먼저 정리
- 현재 `room` 주변 용어를 `활동 세션` 관점으로 바꾸기

### Phase 2

- 세션 엔진과 활동 전용 로직 분리
- `student-actions`에서 `outline_builder` 전용 로직을 떼어내기

### Phase 3

- `exit_ticket_writer` 구현
- 학생 활동 화면을 `activityRegistry` 기반으로 연결

### Phase 4

- 교사용 결과 보관함 강화
- 세션별, 그룹별, 학생별, 활동 유형별 다시 보기 제공

## 13. 현재 코드베이스에 대한 피드백

이 프로젝트는 새로 만드는 것보다 진화시키는 쪽이 훨씬 유리합니다.

좋은 점:

- 현재 명단 구조가 이미 쉬운 입장 방식과 잘 맞음
- 활동 registry 뼈대가 이미 있음
- DB도 활동 확장 여지를 갖고 있음

주의할 점:

- 런타임이 아직 한 가지 활동 형태를 기본 전제로 가정함
- 공통 세션 로직과 `outline_builder` 전용 로직이 아직 섞여 있음

최종 권장:

- 처음부터 다시 만들지 않기
- 먼저 개념과 용어를 정리하기
- 그다음 세션 엔진과 활동 플러그인을 분리하기
- 마지막으로 단순한 두 번째 활동을 붙여 구조를 검증하기
