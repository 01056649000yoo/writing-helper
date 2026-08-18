import type { ActivityType } from "../types";

/**
 * 학생 한 명의 결과를 **모달 안**에 그리는 계약.
 *
 * 활동 내용(왼쪽)과 같은 방식이다 — 껍데기(모달·이름·닫기)는 공유하고
 * 활동마다 다른 것은 이 안쪽 하나뿐이다. 새 활동을 만들 때는 이 모양의 함수를 하나 만들어
 * `student-result/registry.ts` 에 등록하면 `보기` 를 눌렀을 때의 모달이 그대로 따라온다.
 *
 * 세션은 `student_sessions` 한 줄 그대로다. 활동마다 답이 담기는 자리가 다르므로
 * (`answers` / `submission`) 좁히는 일은 각 함수가 한다.
 */
export type StudentResultProps = {
  activityType: ActivityType;
  session: {
    id: string;
    studentName: string;
    studentNumber: number | string | null;
    answers: unknown;
    submission: unknown;
    result: unknown;
  };
  /** 방 설정. 질문 후보처럼 "학생이 무엇 중에서 골랐는지"를 보여 줄 때 쓴다. */
  config: unknown;
};

export type StudentResultRenderer = (props: StudentResultProps) => React.ReactNode;
