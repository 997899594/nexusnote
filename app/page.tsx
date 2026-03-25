import { HeroInput } from "@/components/home";
import { FloatingHeader } from "@/components/shared/layout";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] safe-top">
      <FloatingHeader />

      <div className="ui-page-shell relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.85),transparent_70%)]" />

        <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-20 md:px-6 md:pb-20 md:pt-32">
          <header className="mb-8 max-w-3xl md:mb-12">
            <div className="ui-badge-pill inline-flex items-center gap-2 px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-black/45">
              <span className="ui-strong-chip h-1.5 w-1.5 rounded-full" />
              学习课程
            </div>

            <h1 className="mt-4 max-w-[10.5ch] text-[2.45rem] font-semibold leading-[0.96] tracking-[-0.06em] text-black/90 sm:text-4xl md:mt-5 md:max-w-[11.5ch] md:text-[3.4rem] lg:text-[4.2rem]">
              输入学习目标，
              <br />
              直接开始课程。
            </h1>

            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-black/55 md:text-lg md:leading-8">
              NexusNote 会先通过课程访谈澄清方向，再生成课程内容，并保留你的学习进度。
            </p>
          </header>

          <div className="mb-10 md:mb-14">
            <HeroInput />
          </div>
        </div>
      </div>
    </main>
  );
}
