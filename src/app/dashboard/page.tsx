import { redirect } from "next/navigation";
import { getClasses } from "@/app/actions/class-actions";
import { DashboardTabs } from "./dashboard-tabs";

/**
 * 연구소 첫 화면.
 *
 * 아지트에서 들어올 때는 `?class_id=` 로 지금 보던 학급을 함께 넘긴다. 그 학급이 이 교사의
 * 것이면 곧바로 학급 화면으로 보낸다 — 아지트에서 이미 학급을 고르고 왔는데 여기서 또 고르는
 * 것은 같은 일을 두 번 시키는 것이다.
 *
 * 학급 id 는 아지트와 **같은 값**이다(통합 모드에서는 `public.classes` 를 그대로 읽는다).
 * 넘어온 id 가 이 교사의 학급이 아니면 무시하고 평소대로 목록을 보여 준다 — 주소를 고쳐
 * 남의 학급으로 들어가는 길을 만들지 않는다.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ class_id?: string }>;
}) {
  const { class_id: requestedClassId } = await searchParams;
  const classes = await getClasses();

  if (requestedClassId && classes.some((item) => item.id === requestedClassId)) {
    redirect(`/dashboard/class/${requestedClassId}`);
  }

  return (
    <main className="lab-page">
      <div className="lab-page__content">
        <DashboardTabs
          classes={classes}
          integratedRoster={process.env.LAB_SSO_ENABLED === "true"}
        />
      </div>
    </main>
  );
}
