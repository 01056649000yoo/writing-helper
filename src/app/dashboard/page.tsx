import { getClasses } from "@/app/actions/class-actions";
import { DashboardTabs } from "./dashboard-tabs";

export default async function DashboardPage() {
  const classes = await getClasses();

  return (
    <main className="lab-page">
      <div className="lab-page__content">
        <DashboardTabs classes={classes} />
      </div>
    </main>
  );
}
