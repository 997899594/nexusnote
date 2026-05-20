import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CareerTreesExplorer } from "@/components/career-trees/CareerTreesExplorer";
import { getDynamicPageSession } from "@/lib/auth/page";
import { getCareerTreeWorkspaceDataFresh } from "@/lib/career-tree/workspace-data";

async function CareerTreesPageContent() {
  const session = await getDynamicPageSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=%2Fcareer-trees");
  }

  const careerTrees = await getCareerTreeWorkspaceDataFresh(session.user.id, 0);

  return (
    <main className="ui-page-shell min-h-dvh overflow-hidden">
      <CareerTreesExplorer
        snapshot={careerTrees.snapshot}
        focusSnapshot={careerTrees.focusSnapshot}
        profileSnapshot={careerTrees.profileSnapshot}
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
