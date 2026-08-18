import type { ActivityType } from "../types";

/**
 * 활동 세션 화면의 **왼쪽(활동 내용)** 을 그리는 계약.
 *
 * 오른쪽 참여 현황은 모든 활동이 똑같이 쓰므로 껍데기(`RoomWorkspace`)가 갖고,
 * 활동마다 다른 것은 이 왼쪽 하나뿐이다. 새 활동을 추가할 때는
 * 이 모양의 컴포넌트를 하나 만들어 `teacher-detail/registry.ts` 에 등록하면
 * 화면 구성은 그대로 따라온다.
 *
 * 설정(`activity_config`)은 방마다 모양이 다르므로 `unknown` 으로 받고,
 * 각 컴포넌트가 자기 normalize 함수로 좁힌다(서버가 준 값을 믿지 않는다).
 */
export type ActivityTeacherDetailProps = {
  activityType: ActivityType;
  config: unknown;
  /** 방의 기본 정보. 설정에 없는 값(글 종류·학년)을 보여 줄 때 쓴다. */
  room: {
    id: string;
    title: string;
    topic: string;
    topicDescription: string;
    subjectType: string | null;
    gradeLevel: string | null;
  };
};

/**
 * 컴포넌트가 아니라 **요소를 만들어 돌려주는 함수**다.
 * 렌더 중에 컴포넌트를 만들면 리액트가 매번 다른 타입으로 보고 상태를 버린다
 * (react-hooks/static-components). 이 화면들은 훅을 쓰지 않으므로 함수로 부른다.
 */
export type ActivityTeacherDetail = (props: ActivityTeacherDetailProps) => React.ReactNode;
