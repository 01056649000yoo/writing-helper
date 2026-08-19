import { LabGuide } from "@/features/activities/LabGuide";

/**
 * 도움말은 상단 메뉴에 둔다.
 *
 * 예전에는 학급 목록 화면의 탭 하나였는데, 학급 안으로 들어가면 사라져
 * 정작 활동을 만드는 자리에서는 볼 수 없었다(2026-08-20 사용자 지적).
 * 내용은 `features/activities/guide.ts` 하나가 소유하고 이 페이지는 그리기만 한다.
 */
export default function LabGuidePage() {
  return (
    <main className="lab-page">
      <div className="lab-page__content max-w-6xl">
        <LabGuide />
      </div>
    </main>
  );
}
