import { ArrowRight, Compass, GraduationCap, Target } from "lucide-react";
import Link from "next/link";
import { getGoldenPathSnapshotCached } from "@/lib/server/golden-path-data";

interface ProfileGoldenPathSummaryProps {
  userId: string;
}

export async function ProfileGoldenPathSummary({ userId }: ProfileGoldenPathSummaryProps) {
  const snapshot = await getGoldenPathSnapshotCached(userId);
  const mainRoute =
    snapshot.routes.find((route) => route.id === snapshot.mainRouteId) ?? snapshot.routes[0];

  if (!mainRoute) {
    return (
      <section className="ui-surface-card-lg rounded-3xl p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              <Compass className="h-4 w-4" />
              主线路径
            </div>
            <h2 className="mt-3 text-xl font-semibold text-[var(--color-text)] md:text-2xl">
              还没有形成稳定主线
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--color-text-tertiary)]">
              先通过访谈生成课程，系统才会逐步识别你的学习主线和下一步技能落点。
            </p>
          </div>
          <Link
            href="/interview"
            className="inline-flex items-center gap-2 rounded-full bg-[#111827] px-4 py-2 text-sm font-medium text-white transition-transform hover:-translate-y-0.5"
          >
            开始课程访谈
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    );
  }

  const nextActions = mainRoute.nextActions.slice(0, 3);
  const linkedCourseCount = mainRoute.linkedLearning.length;

  return (
    <section className="ui-surface-card-lg rounded-3xl p-5 md:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            <Compass className="h-4 w-4" />
            主线路径
          </div>
          <h2 className="mt-3 text-xl font-semibold text-[var(--color-text)] md:text-2xl">
            {mainRoute.name}
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--color-text-tertiary)]">
            {mainRoute.tagline}
          </p>
        </div>

        <Link
          href={`/golden-path?path=${mainRoute.id}`}
          className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
        >
          查看命途树
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-black/6 bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fa_100%)] p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                当前进度
              </p>
              <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                {mainRoute.progress}%
              </div>
            </div>
            <div className="rounded-2xl bg-[var(--color-panel-soft)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
              {linkedCourseCount} 门相关课程
            </div>
          </div>

          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[var(--color-hover)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#111827_0%,#6b7280_100%)]"
              style={{ width: `${Math.max(8, mainRoute.progress)}%` }}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--color-text-secondary)]">
            <span className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5">
              进行中 {mainRoute.inProgressCount}
            </span>
            <span className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5">
              已掌握 {mainRoute.masteredCount}
            </span>
            <span className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1.5">
              待解锁 {mainRoute.lockedCount}
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-black/6 bg-[var(--color-panel-soft)] p-4 md:p-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            <Target className="h-4 w-4" />
            下一步落点
          </div>
          <div className="mt-4 space-y-3">
            {nextActions.length > 0 ? (
              nextActions.map((skill) => (
                <div key={skill.id} className="flex items-start gap-3">
                  <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[var(--color-text-secondary)]">
                    <GraduationCap className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--color-text)]">{skill.name}</div>
                    <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                      当前进度 {Math.round(skill.progressScore)}%
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--color-text-tertiary)]">
                先积累更多课程和学习记录，系统再给出更明确的下一步建议。
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
