import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CareerTreesExplorer } from "@/components/career-trees/CareerTreesExplorer";
import { FloatingHeader, WorkspacePageShell } from "@/components/shared/layout";
import { getDynamicPageSession } from "@/lib/auth/page";
import { getCareerTreeWorkspaceDataFresh } from "@/lib/career-tree/workspace-data";

async function CareerTreesPageContent() {
  const session = await getDynamicPageSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=%2Fcareer-trees");
  }

  const careerTrees = await getCareerTreeWorkspaceDataFresh(session.user.id, 0);

  return (
    <WorkspacePageShell
      frameClassName="ui-page-frame-wide"
      header={<FloatingHeader showBackHint title="职业树" variant="workspace" />}
      shellClassName="ui-page-shell"
    >
      <CareerTreesExplorer
        snapshot={careerTrees.snapshot}
        focusSnapshot={careerTrees.focusSnapshot}
        profileSnapshot={careerTrees.profileSnapshot}
      />
    </WorkspacePageShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--color-bg)]" />}>
      <CareerTreesPageContent />
    </Suspense>
  );
}
