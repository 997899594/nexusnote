import { Suspense } from "react";
import { HeroInput, RecentSectionServer } from "@/components/home";
import { FloatingHeader } from "@/components/shared/layout";

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-[var(--color-bg)] safe-top">
      <FloatingHeader showMenuButton />

      <div className="ui-page-shell relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.85),transparent_70%)]" />

        <div className="ui-page-frame relative ui-bottom-breathing-room pt-24 md:pt-32">
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

          <Suspense fallback={<RecentSkeleton />}>
            <RecentSectionServer />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

function RecentSkeleton() {
  return (
    <section className="mb-14">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="h-3 w-20 animate-pulse rounded-full bg-black/8" />
          <div className="mt-3 h-7 w-28 animate-pulse rounded-full bg-black/10" />
          <div className="mt-2 h-4 w-56 animate-pulse rounded-full bg-black/8" />
        </div>
        <div className="hidden h-8 w-20 animate-pulse rounded-full bg-black/8 md:block" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="ui-surface-card h-36 animate-pulse rounded-[28px] bg-black/[0.035]"
          />
        ))}
      </div>
    </section>
  );
}
