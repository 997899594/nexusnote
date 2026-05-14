import { ArrowLeft, Zap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CareerTreesExplorer } from "@/components/career-trees/CareerTreesExplorer";
import { WorkspacePageShell } from "@/components/shared/layout";
import { UserAvatar } from "@/components/shared/layout/UserAvatar";
import { getDynamicPageSession } from "@/lib/auth/page";
import { getCareerTreeWorkspaceDataFresh } from "@/lib/career-tree/workspace-data";

function CareerTreesHeader() {
  return (
    <header className="fixed top-4 left-4 right-4 z-50">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
        <Link
          href="/"
          className="group flex items-center gap-3 rounded-full border border-[#4b3218]/70 bg-[#080604]/88 px-2.5 py-2 pr-4 text-[#f2e5cd] shadow-[0_18px_60px_-36px_rgba(0,0,0,0.9),inset_0_0_20px_rgba(216,172,88,0.08)] backdrop-blur-xl transition-colors hover:border-[#d8ac58]/55"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d8ac58]/50 bg-[radial-gradient(circle_at_35%_28%,rgba(255,222,145,0.16),rgba(10,8,6,0.96))] text-[#f4d995] shadow-[0_0_28px_rgba(216,172,88,0.2)] transition-transform group-hover:rotate-6">
            <Zap className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-col leading-none">
            <span className="text-[10px] uppercase tracking-[0.28em] text-[#b98a43]">
              Career Trees
            </span>
            <span className="mt-1 text-sm font-medium">职业树</span>
          </span>
          <span className="hidden items-center gap-1 rounded-full border border-[#4b3218]/70 px-2.5 py-1 text-[11px] text-[#c7ae78]/80 md:inline-flex">
            <ArrowLeft className="h-3 w-3" />
            返回首页
          </span>
        </Link>

        <div className="rounded-full border border-[#4b3218]/70 bg-[#080604]/88 p-1.5 shadow-[0_18px_60px_-36px_rgba(0,0,0,0.9),inset_0_0_18px_rgba(216,172,88,0.08)] backdrop-blur-xl">
          <UserAvatar className="ring-1 ring-[#d8ac58]/35 ring-offset-2 ring-offset-[#080604]" />
        </div>
      </div>
    </header>
  );
}

async function CareerTreesPageContent() {
  const session = await getDynamicPageSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=%2Fcareer-trees");
  }

  const careerTrees = await getCareerTreeWorkspaceDataFresh(session.user.id, 0);

  return (
    <WorkspacePageShell
      frameClassName="ui-page-frame-wide"
      header={<CareerTreesHeader />}
      shellClassName="bg-[radial-gradient(circle_at_50%_0%,rgba(159,108,41,0.16),transparent_32%),linear-gradient(180deg,#090806_0%,#050505_100%)]"
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
