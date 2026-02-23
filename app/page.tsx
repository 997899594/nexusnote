import { Suspense } from "react";
import { HeroInput, RecentSectionServer } from "@/components/home";
import { FloatingHeader } from "@/components/shared/layout";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 safe-top">
      <FloatingHeader />

      <div className="max-w-4xl mx-auto px-4 md:px-6 pt-20 md:pt-28 pb-16 md:pb-20">
        <header className="mb-10 md:mb-14">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-zinc-900 mb-2 md:mb-3 tracking-tight">
            你的私人学习顾问
          </h1>
          <p className="text-base md:text-lg text-zinc-500">让 AI 为你规划、记忆、测评</p>
        </header>

        <div className="mb-10 md:mb-14">
          <HeroInput />
        </div>

        <Suspense fallback={<RecentSkeleton />}>
          <RecentSectionServer />
        </Suspense>
      </div>
    </main>
  );
}

function RecentSkeleton() {
  return (
    <section className="mb-14">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-medium text-zinc-700">最近</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-28 bg-zinc-100 rounded-xl animate-pulse" />
        ))}
      </div>
    </section>
  );
}
