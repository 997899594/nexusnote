import { ArrowRight, Compass, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { getGoldenPathSnapshotCached } from "@/lib/server/golden-path-data";

interface GoldenPathPreviewProps {
  userId: string;
}

export async function GoldenPathPreview({ userId }: GoldenPathPreviewProps) {
  const snapshot = await getGoldenPathSnapshotCached(userId);
  const mainRoute =
    snapshot.routes.find((route) => route.id === snapshot.mainRouteId) ?? snapshot.routes[0];

  if (!mainRoute) {
    return (
      <section className="ui-surface-card overflow-hidden rounded-[28px] p-6 md:p-7">
        <p className="text-sm text-[var(--color-text-tertiary)]">黄金之路暂时还没有足够数据。</p>
      </section>
    );
  }

  return (
    <section className="ui-surface-card overflow-hidden rounded-[28px] p-6 md:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="ui-badge-pill inline-flex items-center gap-2 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-black/45">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c58f2a]" />
            黄金之路
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)] md:text-3xl">
            {mainRoute.name}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)] md:text-base">
            {mainRoute.tagline}
          </p>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/6">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#c58f2a_0%,#e7c772_100%)]"
              style={{ width: `${mainRoute.progress}%` }}
            />
          </div>
        </div>

        <Link
          href={`/golden-path?path=${mainRoute.id}`}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-panel-strong)] px-4 py-2 text-sm font-medium text-[var(--color-panel-strong-fg)] transition-transform hover:-translate-y-0.5"
        >
          查看完整主线
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-[#f7f4ec] p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[#8f6b24]">
            <Target className="h-4 w-4" />
            当前进度
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
            {mainRoute.progress}%
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            已掌握 {mainRoute.masteredCount} 个关键节点，正在推进 {mainRoute.inProgressCount} 个。
          </p>
        </div>

        <div className="rounded-2xl bg-[#f4f5f7] p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
            <Sparkles className="h-4 w-4" />
            下一步
          </div>
          <div className="mt-3 space-y-2">
            {mainRoute.nextActions.slice(0, 3).map((skill) => (
              <div key={skill.id} className="text-sm text-[var(--color-text)]">
                {skill.name}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[#f4f5f7] p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
            <Compass className="h-4 w-4" />
            潜在线
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
            {snapshot.futureRoutes.length}
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            系统已根据你的课程覆盖和章节推进推演出后续可能延展方向。
          </p>
        </div>
      </div>
    </section>
  );
}
