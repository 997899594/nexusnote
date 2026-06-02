import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CareerTreesExplorer } from "@/components/career-trees/CareerTreesExplorer";
import { getDynamicPageSession } from "@/lib/auth/page";
import { getLatestCareerPlanningState } from "@/lib/career-planning/state";
import { buildCareerPlanningWorkspaceDataFromCareerWorkspace } from "@/lib/career-planning/workspace-data";
import { getCareerTreeWorkspaceDataFresh } from "@/lib/career-tree/workspace-data";

async function CareerTreesPageContent() {
  const session = await getDynamicPageSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=%2Fcareer-trees");
  }

  const [careerTrees, planningState] = await Promise.all([
    getCareerTreeWorkspaceDataFresh(session.user.id, 4),
    getLatestCareerPlanningState(session.user.id),
  ]);
  const planningData = await buildCareerPlanningWorkspaceDataFromCareerWorkspace({
    workspace: careerTrees,
    planningState,
  });

  return (
    <main className="ui-page-shell min-h-dvh overflow-x-hidden lg:overflow-hidden">
      <CareerTreesExplorer
        snapshot={careerTrees.snapshot}
        focusSnapshot={careerTrees.focusSnapshot}
        profileSnapshot={careerTrees.profileSnapshot}
        planningData={planningData}
      />
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--color-bg)]" />}>
      <CareerTreesPageContent />
    </Suspense>
  );
}
