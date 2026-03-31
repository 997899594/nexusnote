import { redirect } from "next/navigation";
import { connection } from "next/server";
import { GoldenPathPage } from "@/components/golden-path/GoldenPathPage";
import { FloatingHeader } from "@/components/shared/layout";
import { auth } from "@/lib/auth";
import { getGoldenPathSnapshotCached } from "@/lib/server/golden-path-data";

interface GoldenPathPageProps {
  searchParams: Promise<{ path?: string }>;
}

export default async function Page({ searchParams }: GoldenPathPageProps) {
  await connection();
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=%2Fgolden-path");
  }

  const { path } = await searchParams;
  const snapshot = await getGoldenPathSnapshotCached(session.user.id);

  return (
    <main className="ui-page-shell min-h-dvh safe-top">
      <FloatingHeader showBackHint showMenuButton />

      <div className="ui-page-frame ui-bottom-breathing-room pt-24 md:pt-28">
        <GoldenPathPage snapshot={snapshot} selectedPathId={path} />
      </div>
    </main>
  );
}
