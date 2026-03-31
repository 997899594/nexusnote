import {
  ArrowRight,
  BookOpen,
  Compass,
  Lock,
  Sparkles,
  Target,
  TrendingUp,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import type {
  GoldenPathLinkedCourse,
  GoldenPathNodeSnapshot,
  GoldenPathSkillState,
  GoldenPathSnapshot,
} from "@/lib/golden-path/types";

interface GoldenPathPageProps {
  snapshot: GoldenPathSnapshot;
  selectedPathId?: string;
}

function getStateLabel(state: GoldenPathSkillState): string {
  switch (state) {
    case "mastered":
      return "已掌握";
    case "in_progress":
      return "学习中";
    case "ready":
      return "可开始";
    case "locked":
      return "待解锁";
  }
}

function getStateClassName(state: GoldenPathSkillState): string {
  switch (state) {
    case "mastered":
      return "border-[#e0bc63] bg-[#2d2310] text-[#f4ddb0]";
    case "in_progress":
      return "border-[#8b7350] bg-[#241f17] text-[#ead3a3]";
    case "ready":
      return "border-[#564730] bg-[#1d1a15] text-[#d5c4a3]";
    case "locked":
      return "border-white/10 bg-white/[0.04] text-white/50";
  }
}

function getStatePriority(state: GoldenPathSkillState): number {
  switch (state) {
    case "mastered":
      return 0;
    case "in_progress":
      return 1;
    case "ready":
      return 2;
    case "locked":
      return 3;
  }
}

function sortSkills(left: GoldenPathNodeSnapshot, right: GoldenPathNodeSnapshot): number {
  return (
    getStatePriority(left.state) - getStatePriority(right.state) ||
    right.importance - left.importance ||
    right.progressScore - left.progressScore
  );
}

function formatDate(value: Date | null): string {
  if (!value) {
    return "最近";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(value);
}

function formatChapterProgress(completedSections: number, totalSections: number): string {
  if (totalSections <= 0) {
    return "待生成内容";
  }

  return `${completedSections}/${totalSections} 节`;
}

function getSkillRelatedLearning(
  skill: GoldenPathNodeSnapshot,
  linkedLearning: GoldenPathLinkedCourse[],
): Array<
  GoldenPathLinkedCourse & {
    relatedChapters: GoldenPathLinkedCourse["matchedChapters"];
  }
> {
  return linkedLearning
    .filter((course) => skill.linkedCourseIds.includes(course.courseId))
    .map((course) => ({
      ...course,
      relatedChapters: course.matchedChapters.filter(
        (chapter) =>
          skill.linkedChapterKeys.includes(chapter.key) ||
          chapter.matchedSkills.includes(skill.name),
      ),
    }))
    .sort((left, right) => {
      const leftScore =
        left.relatedChapters.length * 18 + left.progressPercent + left.matchedSkills.length * 6;
      const rightScore =
        right.relatedChapters.length * 18 + right.progressPercent + right.matchedSkills.length * 6;
      return rightScore - leftScore;
    })
    .slice(0, 3);
}

function renderSkillCard(
  skill: GoldenPathNodeSnapshot,
  linkedLearning: GoldenPathLinkedCourse[],
): React.JSX.Element {
  const relatedLearning = getSkillRelatedLearning(skill, linkedLearning);

  return (
    <details key={skill.id} className={`rounded-2xl border p-3 ${getStateClassName(skill.state)}`}>
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{skill.name}</div>
            <div className="mt-1 text-xs opacity-70">{getStateLabel(skill.state)}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium">{skill.progressScore}%</div>
            <div className="mt-1 text-[11px] opacity-65">
              掌握 {skill.masteryScore}% · 覆盖 {skill.coverageScore}%
            </div>
          </div>
        </div>
      </summary>

      <div className="mt-3 space-y-3 border-t border-white/10 pt-3 text-xs opacity-80">
        <p className="leading-6">{skill.description}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>关联课程 {skill.evidence.courseCount}</div>
          <div>关联章节 {skill.evidence.chapterCount}</div>
          <div>完成信号 {skill.evidence.masterySignals}</div>
          <div>当前状态 {getStateLabel(skill.state)}</div>
        </div>

        {relatedLearning.length > 0 && (
          <div className="space-y-2 border-t border-white/10 pt-3">
            <div className="text-[11px] uppercase tracking-[0.16em] opacity-55">相关学习入口</div>
            <div className="space-y-2">
              {relatedLearning.map((course) => (
                <div
                  key={`${skill.id}:${course.courseId}`}
                  className="rounded-xl bg-black/10 px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/learn/${course.courseId}`}
                      className="text-sm font-medium text-inherit transition-opacity hover:opacity-100"
                    >
                      {course.title}
                    </Link>
                    <div className="text-right">
                      <div className="text-[11px] opacity-60">{course.progressPercent}%</div>
                      <div className="text-[11px] opacity-45">{formatDate(course.updatedAt)}</div>
                    </div>
                  </div>

                  {course.relatedChapters.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {course.relatedChapters.map((chapter) => (
                        <Link
                          key={chapter.key}
                          href={`/learn/${course.courseId}?chapter=${chapter.chapterIndex}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] transition-colors hover:bg-white/10"
                        >
                          <div className="min-w-0">
                            <div className="truncate">
                              第 {chapter.chapterIndex} 章 · {chapter.title}
                            </div>
                            <div className="mt-1 opacity-55">
                              {chapter.matchedSkills.join(" · ")}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pl-2">
                            <span className="rounded-full border border-white/10 px-2 py-0.5 opacity-65">
                              {formatChapterProgress(
                                chapter.completedSections,
                                chapter.totalSections,
                              )}
                            </span>
                            <ArrowRight className="h-3 w-3" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] opacity-60">
                      当前已关联课程，章节证据还在继续沉淀。
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

export function GoldenPathPage({ snapshot, selectedPathId }: GoldenPathPageProps) {
  const selectedRoute =
    snapshot.routes.find((route) => route.id === selectedPathId) ??
    snapshot.routes.find((route) => route.id === snapshot.mainRouteId) ??
    snapshot.routes[0];

  if (!selectedRoute) {
    return (
      <section className="ui-surface-card rounded-[32px] p-8">
        <p className="text-[var(--color-text-secondary)]">黄金之路暂时还没有可展示的数据。</p>
      </section>
    );
  }

  return (
    <div className="space-y-6 md:space-y-7">
      <section className="overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_top_left,rgba(232,199,113,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_24%),linear-gradient(145deg,#121212_0%,#17140f_48%,#1e1912_100%)] px-6 py-7 text-white shadow-[0_32px_80px_-42px_rgba(15,23,42,0.42)] md:px-8 md:py-9">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-white/65">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e7c772]" />
              黄金之路
            </div>

            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-white md:text-5xl">
              {selectedRoute.name}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 md:text-base md:leading-8">
              {selectedRoute.tagline}
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/50 md:text-base">
              {selectedRoute.description}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {selectedRoute.outcomes.map((outcome) => (
                <span
                  key={outcome}
                  className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm text-white/72"
                >
                  {outcome}
                </span>
              ))}
            </div>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-[22rem]">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/50">
                <Target className="h-4 w-4" />
                主线进度
              </div>
              <div className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white">
                {selectedRoute.progress}%
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#c58f2a_0%,#e7c772_100%)]"
                  style={{ width: `${selectedRoute.progress}%` }}
                />
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/50">
                <TrendingUp className="h-4 w-4" />
                匹配度
              </div>
              <div className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white">
                {selectedRoute.fitScore}%
              </div>
              <p className="mt-2 text-sm text-white/55">
                目前只基于课程覆盖、章节映射和完成进度推断。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="ui-surface-card rounded-[28px] p-5 md:p-6">
        <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          <Compass className="h-4 w-4" />
          Path Navigator
        </div>
        <div className="flex flex-wrap gap-3">
          {snapshot.routes.map((route) => {
            const isActive = route.id === selectedRoute.id;
            return (
              <Link
                key={route.id}
                href={`/golden-path?path=${route.id}`}
                className={`rounded-2xl border px-4 py-3 transition-all ${
                  isActive
                    ? "border-[#d2b164] bg-[#faf4e7] text-[var(--color-text)] shadow-[0_18px_40px_-28px_rgba(15,23,42,0.18)]"
                    : "border-black/8 bg-white text-[var(--color-text-secondary)] hover:border-black/14 hover:bg-[#fafafa]"
                }`}
              >
                <div className="text-sm font-medium">{route.name}</div>
                <div className="mt-1 text-xs opacity-70">
                  匹配度 {route.fitScore}% · 进度 {route.progress}%
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <section className="overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_top_left,rgba(231,199,114,0.12),transparent_28%),linear-gradient(180deg,#151515_0%,#171717_100%)] p-5 text-white shadow-[0_28px_64px_-40px_rgba(15,23,42,0.45)] md:p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/45">
                <Waypoints className="h-4 w-4" />
                能力网络
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                当前主线网络
              </h2>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm text-white/60">
              {selectedRoute.domains.length} 个能力域
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {selectedRoute.domains.map((domain) => (
              <div
                key={domain.id}
                className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-medium text-white">{domain.name}</h3>
                    <p className="mt-1 text-sm leading-6 text-white/55">{domain.description}</p>
                  </div>
                  <div className="rounded-full bg-white/[0.06] px-3 py-1 text-sm text-white/70">
                    {domain.progress}%
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {[...domain.nodes]
                    .sort(sortSkills)
                    .map((skill) => renderSkillCard(skill, selectedRoute.linkedLearning))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <section className="ui-surface-card rounded-[28px] p-5 md:p-6">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              <Sparkles className="h-4 w-4" />
              下一步
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
              现在最值得补的节点
            </h2>

            <div className="mt-5 space-y-3">
              {selectedRoute.nextActions.map((skill) => (
                <div key={skill.id} className="rounded-2xl bg-[#f6f4ee] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-[var(--color-text)]">{skill.name}</div>
                      <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {skill.description}
                      </div>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-sm text-[var(--color-text-secondary)]">
                      {getStateLabel(skill.state)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="ui-surface-card rounded-[28px] p-5 md:p-6">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              <Lock className="h-4 w-4" />
              缺口分析
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
              关键缺口
            </h2>

            <div className="mt-5 space-y-3">
              {selectedRoute.criticalGaps.map((skill) => (
                <div key={skill.id} className="rounded-2xl border border-black/8 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-[var(--color-text)]">{skill.name}</div>
                      <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        {skill.description}
                      </div>
                    </div>
                    <div className="text-sm text-[var(--color-text-tertiary)]">
                      {skill.progressScore}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="ui-surface-card rounded-[28px] p-5 md:p-6">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            <BookOpen className="h-4 w-4" />
            Linked Learning
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
            课程与章节如何推动这条主线
          </h2>

          <div className="mt-5 space-y-4">
            {selectedRoute.linkedLearning.length > 0 ? (
              selectedRoute.linkedLearning.map((course) => (
                <div key={course.courseId} className="rounded-[24px] bg-[#f7f7f6] p-4 md:p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <Link
                        href={`/learn/${course.courseId}`}
                        className="text-lg font-medium text-[var(--color-text)] transition-colors hover:text-[#8b6a24]"
                      >
                        {course.title}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {course.matchedSkills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full bg-white px-3 py-1 text-sm text-[var(--color-text-secondary)]"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-sm text-[var(--color-text-tertiary)]">
                      进度 {course.progressPercent}% · {formatDate(course.updatedAt)}
                      <div className="mt-2">
                        <Link
                          href={`/learn/${course.courseId}`}
                          className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[0.72rem] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[#fcfbf8] hover:text-[var(--color-text)]"
                        >
                          进入课程
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {course.matchedChapters.length > 0 && (
                    <div className="mt-4 space-y-3 border-t border-black/6 pt-4">
                      {course.matchedChapters.map((chapter) => (
                        <Link
                          key={chapter.key}
                          href={`/learn/${course.courseId}?chapter=${chapter.chapterIndex}`}
                          className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 transition-colors hover:bg-[#fcfbf8]"
                        >
                          <div>
                            <div className="text-sm font-medium text-[var(--color-text)]">
                              第 {chapter.chapterIndex} 章 · {chapter.title}
                            </div>
                            <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
                              {chapter.matchedSkills.join(" · ")}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="rounded-full border border-black/8 bg-[#faf8f2] px-2.5 py-1 text-[0.72rem] text-[var(--color-text-secondary)]">
                              {formatChapterProgress(
                                chapter.completedSections,
                                chapter.totalSections,
                              )}
                            </span>
                            <ArrowRight className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-black/10 p-6 text-[var(--color-text-secondary)]">
                还没有足够强的课程映射证据。生成更多课程并继续推进章节后，这里会更准确。
              </div>
            )}
          </div>
        </section>

        <section className="ui-surface-card rounded-[28px] p-5 md:p-6">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            <Compass className="h-4 w-4" />
            Future Paths
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
            可延展方向
          </h2>

          <div className="mt-5 space-y-3">
            {snapshot.futureRoutes.map((route) => (
              <Link
                key={route.id}
                href={`/golden-path?path=${route.id}`}
                className="block rounded-2xl border border-black/8 bg-white p-4 transition-colors hover:bg-[#faf9f7]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-[var(--color-text)]">{route.name}</div>
                    <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      还缺 {route.missingSkills.join(" · ")}
                    </div>
                  </div>
                  <div className="text-right text-sm text-[var(--color-text-tertiary)]">
                    <div>{route.fitScore}%</div>
                    <div className="mt-1">进度 {route.progress}%</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
