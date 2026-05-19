import { Suspense } from "react";
import { HeroInput } from "@/components/home/HeroInput";
import { RecentSectionServer, RecentSectionSkeleton } from "@/components/home/RecentSectionServer";
import { FloatingHeader, LandingPageShell } from "@/components/shared/layout";

export default function HomePage() {
  return (
    <LandingPageShell
      header={<FloatingHeader title="NexusNote" variant="compact" />}
      background={
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.85),transparent_70%)]" />
      }
    >
      <div className="mb-10 w-full md:mb-12">
        <HeroInput />
      </div>

      <Suspense fallback={<RecentSectionSkeleton />}>
        <RecentSectionServer />
      </Suspense>
    </LandingPageShell>
  );
}
