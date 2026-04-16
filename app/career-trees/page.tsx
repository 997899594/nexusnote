import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CareerTreesPage } from "@/components/career-trees/CareerTreesPage";
import { FloatingHeader, WorkspacePageShell } from "@/components/shared/layout";
import { getGrowthSnapshotCached } from "@/lib/growth/snapshot";
import {
  getLatestFocusSnapshotCached,
  getLatestProfileSnapshotCached,
} from "@/lib/server/growth-projections-data";
import { getTopKnowledgeInsightsCached } from "@/lib/server/knowledge-insights-data";
import { getDynamicPageSession } from "@/lib/server/page-auth";

async function CareerTreesPageContent() {
  const session = await getDynamicPageSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=%2Fcareer-trees");
  }

  const [snapshot, profileSnapshot, focusSnapshot, insights] = await Promise.all([
    getGrowthSnapshotCached(session.user.id),
    getLatestProfileSnapshotCached(session.user.id),
    getLatestFocusSnapshotCached(session.user.id),
    getTopKnowledgeInsightsCached(session.user.id, 3),
  ]);

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
      <CareerTreesPage
        snapshot={snapshot}
        insights={insights}
        focusSnapshot={focusSnapshot}
        profileSnapshot={profileSnapshot}
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
