import { ArrowRight, Compass, Sparkles, Swords } from "lucide-react";
import Link from "next/link";
import { getGoldenPathSnapshotCached } from "@/lib/server/golden-path-data";

interface GoldenPathPreviewProps {
  userId: string;
}

function getStateTone(state: "mastered" | "in_progress" | "ready" | "locked"): string {
  switch (state) {
    case "mastered":
      return "border-[#d8b35f]/45 bg-[#f7eed7] text-[#7d6221]";
    case "in_progress":
      return "border-[#d9c49d]/45 bg-[#f5efe2] text-[#7d6124]";
    case "ready":
      return "border-black/8 bg-[#f6f7f9] text-[var(--color-text-secondary)]";
    case "locked":
      return "border-black/6 bg-[#f8f9fb] text-[var(--color-text-tertiary)]";
  }
}

export async function GoldenPathPreview({ userId }: GoldenPathPreviewProps) {
  const snapshot = await getGoldenPathSnapshotCached(userId);
  const mainRoute =
    snapshot.routes.find((route) => route.id === snapshot.mainRouteId) ?? snapshot.routes[0];
  const alternateRoutes = snapshot.routes.filter((route) => route.id !== mainRoute?.id).slice(0, 3);

  if (!mainRoute) {
    return (
      <section className="ui-surface-card overflow-hidden rounded-[28px] p-6 md:p-7">
        <p className="text-sm text-[var(--color-text-tertiary)]">黄金之路暂时还没有足够数据。</p>
      </section>
    );
  }

  const domainPreview = mainRoute.domains.slice(0, 3);
  const activeSkillPreview = mainRoute.nextActions.slice(0, 4);

  return (
    <section className="overflow-hidden rounded-[30px] border border-[#2a2419] bg-[radial-gradient(circle_at_top_left,rgba(231,199,114,0.12),transparent_28%),linear-gradient(180deg,#11100d_0%,#16130f_100%)] p-6 text-white shadow-[0_30px_70px_-42px_rgba(15,23,42,0.42)] md:p-7">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-white/55">
              <span className="h-1.5 w-1.5 rounded-full bg-[#c58f2a]" />
              黄金之路
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white md:text-3xl">
              系统当前主线：{mainRoute.name}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/68 md:text-base">
              {mainRoute.tagline}
            </p>
          </div>

          <div className="flex flex-col items-start gap-3">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.05] px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                系统主线进度
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">
                {mainRoute.progress}%
              </div>
            </div>
            <Link
              href={`/golden-path?path=${mainRoute.id}`}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#15120e] transition-transform hover:-translate-y-0.5"
            >
              查看命途树
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(231,199,114,0.08),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.02))] px-4 py-5 md:px-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/45">
              <Compass className="h-4 w-4" />
              命途预览
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] text-white/58">
              候选线 {alternateRoutes.length}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="overflow-hidden rounded-[24px] border border-white/8 bg-black/15 px-4 py-5">
              <div className="relative mx-auto flex min-h-[260px] max-w-[720px] items-start justify-center">
                <div className="pointer-events-none absolute top-9 h-[165px] w-[2px] rounded-full bg-[linear-gradient(180deg,rgba(215,178,93,0.8),rgba(215,178,93,0.15))]" />

                <div className="absolute top-0 flex w-full justify-center">
                  <div className="min-w-[220px] rounded-[24px] border border-[#d3b162]/35 bg-[radial-gradient(circle_at_top_left,rgba(231,199,114,0.14),transparent_42%),linear-gradient(180deg,#1b160f_0%,#16120d_100%)] px-4 py-3 text-center shadow-[0_24px_52px_-34px_rgba(224,188,99,0.46)]">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                      系统主线
                    </div>
                    <div className="mt-2 text-base font-semibold text-white">{mainRoute.name}</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#9a6e24_0%,#d3b162_60%,#f0dca8_100%)]"
                        style={{ width: `${Math.max(8, mainRoute.progress)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="absolute top-[108px] left-0 right-0 flex items-start justify-between gap-4 px-3">
                  {domainPreview.map((domain, index) => {
                    const isLeft = index === 0;
                    const isCenter = index === 1;
                    const lineClass = isCenter
                      ? "left-1/2 -translate-x-1/2"
                      : isLeft
                        ? "right-6"
                        : "left-6";

                    return (
                      <div key={domain.id} className="relative flex flex-1 justify-center">
                        <div
                          className={`pointer-events-none absolute -top-9 h-9 w-[2px] rounded-full bg-[linear-gradient(180deg,rgba(215,178,93,0.45),rgba(215,178,93,0.08))] ${lineClass}`}
                        />
                        <div className="min-w-[150px] rounded-[20px] border border-white/10 bg-white/[0.06] px-3 py-3 text-center">
                          <div className="text-xs font-semibold text-white">{domain.name}</div>
                          <div className="mt-1 text-[11px] text-white/55">{domain.progress}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="absolute bottom-0 left-0 right-0 flex flex-wrap items-center justify-center gap-2 px-4">
                  {activeSkillPreview.map((skill) => (
                    <span
                      key={skill.id}
                      className={`rounded-full border px-3 py-1.5 text-[0.72rem] font-medium ${getStateTone(skill.state)}`}
                    >
                      {skill.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/50">
                  <Sparkles className="h-4 w-4" />
                  下一步落点
                </div>
                <div className="mt-3 space-y-2">
                  {mainRoute.nextActions.slice(0, 3).map((skill) => (
                    <div key={skill.id} className="text-sm text-white/86">
                      {skill.name}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/50">
                  <Swords className="h-4 w-4" />
                  其他候选命途
                </div>
                <div className="mt-3 space-y-2">
                  {alternateRoutes.map((route) => (
                    <Link
                      key={route.id}
                      href={`/golden-path?path=${route.id}`}
                      className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/10 px-3 py-2.5 text-sm transition-colors hover:bg-white/[0.06]"
                    >
                      <div>
                        <div className="font-medium text-white/88">{route.name}</div>
                        <div className="mt-1 text-[11px] text-white/52">
                          匹配度 {route.fitScore}% · 进度 {route.progress}%
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-white/40" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
