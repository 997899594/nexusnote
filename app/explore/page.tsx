import { BookOpen, Clock, User } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { FloatingHeader, LandingPageShell } from "@/components/shared/layout";
import { getPublicCourseCatalog } from "@/lib/learning/public-course-catalog";

async function ExplorePageContent() {
  await connection();
  const items = await getPublicCourseCatalog(24);

  return (
    <LandingPageShell
      header={<FloatingHeader title="发现课程" subtitle="NexusNote" variant="compact" />}
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text)] md:text-3xl">发现课程</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">浏览社区成员分享的 AI 生成课程</p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <BookOpen className="h-12 w-12 text-[var(--color-text-muted)]" />
          <p className="text-lg font-medium text-[var(--color-text)]">还没有公开课程</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            学习一门课后，你可以将它发布到社区
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/c/${item.slug}`}
              className="group flex flex-col gap-3 rounded-lg border border-[var(--color-active)] bg-[var(--color-surface)] p-5 transition-all hover:border-[var(--color-accent)] hover:shadow-md"
            >
              <h2 className="text-base font-semibold text-[var(--color-text)] group-hover:text-[var(--color-accent)]">
                {item.title}
              </h2>
              {item.description ? (
                <p className="line-clamp-2 text-sm text-[var(--color-text-muted)]">
                  {item.description}
                </p>
              ) : null}
              <div className="mt-auto flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {item.chapterCount} 章
                </span>
                {item.ownerName ? (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {item.ownerName}
                  </span>
                ) : null}
                {item.publishedAt ? (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(item.publishedAt).toLocaleDateString("zh-CN")}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </LandingPageShell>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--color-bg)]" />}>
      <ExplorePageContent />
    </Suspense>
  );
}
