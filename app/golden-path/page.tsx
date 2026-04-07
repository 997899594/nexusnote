import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GoldenPathPage } from "@/components/golden-path/GoldenPathPage";
import { FloatingHeader } from "@/components/shared/layout";
import { getGoldenPathSnapshotCached } from "@/lib/server/golden-path-data";
import { getDynamicPageSession } from "@/lib/server/page-auth";

interface GoldenPathPageProps {
  searchParams: Promise<{ path?: string }>;
}

async function GoldenPathPageContent({ searchParams }: GoldenPathPageProps) {
  const session = await getDynamicPageSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=%2Fgolden-path");
  }

  const { path } = await searchParams;
  const snapshot = await getGoldenPathSnapshotCached(session.user.id);

  return (
    <main className="ui-page-shell min-h-dvh">
      <FloatingHeader showBackHint showMenuButton />

      <div className="ui-page-frame ui-floating-header-offset ui-bottom-breathing-room">
        <GoldenPathPage snapshot={snapshot} selectedPathId={path} />
      </div>
    </main>
  );
}

export default function Page({ searchParams }: GoldenPathPageProps) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--color-bg)]" />}>
      <GoldenPathPageContent searchParams={searchParams} />
    </Suspense>
  );
}
