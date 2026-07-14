import { Suspense } from "react";
import { RecentSectionServer, RecentSectionSkeleton } from "@/components/home/RecentSectionServer";
import { FloatingHeader, LandingPageShell } from "@/components/shared/layout";
import { getDynamicPageSession } from "@/lib/auth/page";

async function HomePageContent() {
  const session = await getDynamicPageSession();

  // Authenticated: show dashboard
  if (session?.user?.id) {
    return (
      <LandingPageShell
        header={<FloatingHeader title="NexusNote" variant="compact" />}
        background={
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.85),transparent_70%)]" />
        }
      >
        <Suspense fallback={<RecentSectionSkeleton />}>
          <RecentSectionServer userId={session.user.id} />
        </Suspense>
      </LandingPageShell>
    );
  }

  return <PublicHome />;
}

function PublicHome() {
  return (
    <LandingPageShell
      header={<FloatingHeader title="NexusNote" subtitle="AI 学习助理" variant="brand" />}
      background={
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),transparent_70%)]" />
      }
    >
      <div className="flex flex-col items-center gap-8 py-8 text-center md:py-16">
        <div className="max-w-2xl space-y-4">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text)] md:text-5xl">
            你的私人 AI 学习助理
          </h1>
          <p className="text-lg text-[var(--color-text-muted)] md:text-xl">
            从学习目标到专属课程，AI 对话学习，知识自动沉淀为技能树
          </p>
        </div>

        <a
          href="/login"
          className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-accent)] px-8 py-4 text-base font-medium text-white shadow-lg transition-transform hover:scale-105"
        >
          免费开始学习
        </a>

        <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              title: "AI 生成课程",
              desc: "输入学习目标，AI 自动生成结构化课程大纲和章节内容",
            },
            {
              title: "对话式学习",
              desc: "围绕课程内容的 AI 对话，像有私人导师一样学习",
            },
            {
              title: "技能成长树",
              desc: "学完的课程自动映射到技能树，看见自己的成长路径",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-[var(--color-active)] bg-[var(--color-surface)] p-5 text-left"
            >
              <h3 className="font-semibold text-[var(--color-text)]">{feature.title}</h3>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </LandingPageShell>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<PublicHome />}>
      <HomePageContent />
    </Suspense>
  );
}
