import { Suspense } from "react";
import { HeroInput } from "@/components/home/HeroInput";
import { RecentSectionServer, RecentSectionSkeleton } from "@/components/home/RecentSectionServer";
import { FloatingHeader, LandingPageShell } from "@/components/shared/layout";

export default function HomePage() {
  return (
    <LandingPageShell
      header={<FloatingHeader showMenuButton title="NexusNote" variant="compact" />}
      background={
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.85),transparent_70%)]" />
      }
    >
      <header className="mb-8 max-w-3xl md:mb-12 lg:mb-14">
        <h1 className="max-w-[10.5ch] text-[2.45rem] font-semibold leading-[0.96] tracking-[-0.06em] text-black/90 sm:text-4xl md:max-w-[11.5ch] md:text-[3.4rem] lg:text-[4.2rem]">
          输入学习目标，
          <br />
          直接开始课程。
        </h1>

        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-black/55 md:text-lg md:leading-8">
          NexusNote 会先通过课程访谈澄清方向，再生成课程内容，并保留你的学习进度。
        </p>
      </header>

      <div className="mb-10 max-w-4xl md:mb-14">
        <HeroInput />
      </div>

      <Suspense fallback={<RecentSectionSkeleton />}>
        <RecentSectionServer />
      </Suspense>
    </LandingPageShell>
  );
}
