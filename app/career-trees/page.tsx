import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CareerTreesExplorer } from "@/components/career-trees/CareerTreesExplorer";
import { FloatingHeader, WorkspacePageShell } from "@/components/shared/layout";
import { getGrowthWorkspaceDataCached } from "@/lib/server/growth-workspace-data";
import { getDynamicPageSession } from "@/lib/server/page-auth";

async function CareerTreesPageContent() {
  const session = await getDynamicPageSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=%2Fcareer-trees");
  }

  const growth = await getGrowthWorkspaceDataCached(session.user.id, 3);

  return (
    <WorkspacePageShell
      header={
        <FloatingHeader
          showBackHint
          showMenuButton
          title="职业树"
          subtitle="Career Trees"
          variant="workspace"
        />
      }
    >
      <CareerTreesExplorer
        snapshot={growth.snapshot}
        insights={growth.insights}
        focusSnapshot={growth.focusSnapshot}
        profileSnapshot={growth.profileSnapshot}
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
