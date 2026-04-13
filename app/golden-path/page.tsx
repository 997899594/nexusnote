import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GoldenPathPage } from "@/components/golden-path/GoldenPathPage";
import { FloatingHeader } from "@/components/shared/layout";
import { getCareerTreeSnapshotCached } from "@/lib/career-tree/snapshot";
import { getDynamicPageSession } from "@/lib/server/page-auth";

async function GoldenPathPageContent() {
  const session = await getDynamicPageSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=%2Fgolden-path");
  }

  const snapshot = await getCareerTreeSnapshotCached(session.user.id);

  return (
    <main className="ui-page-shell min-h-dvh">
      <FloatingHeader
        showBackHint
        showMenuButton
        title="职业树"
        subtitle="Career Trees"
        variant="workspace"
      />

      <div className="ui-page-frame ui-floating-header-offset ui-bottom-breathing-room">
        <GoldenPathPage snapshot={snapshot} />
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--color-bg)]" />}>
      <GoldenPathPageContent />
    </Suspense>
  );
}
