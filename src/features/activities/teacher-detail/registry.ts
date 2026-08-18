import type { ActivityType } from "../types";
import type { ActivityTeacherDetail } from "./types";
import { OutlineBuilderDetail } from "./OutlineBuilderDetail";
import { QuestionGeneratorDetail } from "./QuestionGeneratorDetail";
import { QuestionVotingDetail } from "./QuestionVotingDetail";
import { OneLineShareDetail } from "./OneLineShareDetail";

/**
 * 활동 세션 화면 **왼쪽(활동 내용)** 을 그리는 컴포넌트 등록처.
 *
 * 새 활동을 추가할 때는 컴포넌트 하나를 만들어 여기에 한 줄 등록하면
 * 좌우 구성·참여 현황·결과 모달은 껍데기(`RoomWorkspace`)가 그대로 준다.
 *
 * 등록하지 않은 활동은 `null` 이 되고, 껍데기가 "설명이 아직 없습니다" 를 대신 보여 준다.
 * 화면이 비지 않게 하려는 것이지 등록을 건너뛰라는 뜻은 아니다.
 */
const TEACHER_DETAIL_BY_ACTIVITY: Partial<Record<ActivityType, ActivityTeacherDetail>> = {
  outline_builder: OutlineBuilderDetail,
  question_generator: QuestionGeneratorDetail,
  question_voting: QuestionVotingDetail,
  one_line_share: OneLineShareDetail,
};

export function getActivityTeacherDetail(activityType: string | null): ActivityTeacherDetail | null {
  if (!activityType) return null;
  // 정해진 목록에서만 꺼낸다(임의 키 조회를 만들지 않는다).
  return Object.hasOwn(TEACHER_DETAIL_BY_ACTIVITY, activityType)
    ? TEACHER_DETAIL_BY_ACTIVITY[activityType as ActivityType] ?? null
    : null;
}
