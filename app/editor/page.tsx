import {
  ArrowUpRight,
  BookOpen,
  Clock3,
  FileText,
  Highlighter,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { FloatingHeader } from "@/components/shared/layout";
import { getNotesWorkbenchCached, type NoteWorkbenchKind } from "@/lib/server/editor-data";
import { requireDynamicPageAuth } from "@/lib/server/page-auth";

function buildExcerpt(plainText: string | null, fallback: string | null) {
  const raw = (plainText || fallback || "").replace(/\s+/g, " ").trim();
  if (!raw) return "从课程内容中沉淀的重点会出现在这里。";
  return raw.length > 120 ? `${raw.slice(0, 120).trim()}...` : raw;
}

function formatDate(date: Date | null) {
  if (!date) return "刚刚更新";

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const KIND_LABELS: Record<NoteWorkbenchKind, string> = {
  all: "全部",
  highlight: "高亮",
  note: "笔记",
  capture: "沉淀",
  manual: "手动",
};

const KIND_META = {
  highlight: { icon: Highlighter, description: "从课程里直接划线留下的重点" },
  note: { icon: NotebookPen, description: "带有自己理解和补充说明的课程笔记" },
  capture: { icon: Sparkles, description: "从学习对话沉淀出来的结构化结论" },
  manual: { icon: FileText, description: "手动创建或通过编辑动作生成的笔记" },
} as const;

async function NotesIndexPageContent({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; courseId?: string }>;
}) {
  const session = await requireDynamicPageAuth("/editor");
  const { kind: rawKind, courseId } = await searchParams;
  const snapshot = await getNotesWorkbenchCached(session.user.id);
  const activeKind = (rawKind as NoteWorkbenchKind | undefined) ?? "all";

  const filteredNotes = snapshot.items.filter((note) => {
    const matchesKind = activeKind === "all" ? true : note.kind === activeKind;
    const matchesCourse = courseId ? note.sourceContext?.courseId === courseId : true;
    return matchesKind && matchesCourse;
  });

  return (
    <main className="ui-page-shell min-h-dvh">
      <FloatingHeader showBackHint showMenuButton />

      <div className="ui-page-frame ui-floating-header-offset max-w-5xl ui-bottom-breathing-room">
        <header className="mb-8 max-w-3xl md:mb-10">
          <div className="ui-badge-pill inline-flex items-center gap-2 px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-black/45">
            <span className="ui-strong-chip h-1.5 w-1.5 rounded-full" />
            学习笔记
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-black/90 md:text-5xl">
            跨课程知识工作台
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-8 text-black/55">
            把高亮、课程笔记和学习沉淀统一收口，不再困在单门课程里。
          </p>
        </header>

        {snapshot.items.length === 0 ? (
          <section className="ui-surface-card-lg rounded-[32px] p-8 md:p-10">
            <div className="flex max-w-xl flex-col items-start gap-4">
              <div className="ui-icon-chip flex h-12 w-12 items-center justify-center">
                <BookOpen className="h-5 w-5 text-[var(--color-text-secondary)]" />
              </div>
              <div>
                <h2 className="text-xl font-medium text-[var(--color-text)]">还没有沉淀笔记</h2>
                <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
                  在课程里选中重点内容，点击“沉淀”，就会自动生成带来源的学习笔记。
                </p>
              </div>
              <Link
                href="/interview"
                className="ui-primary-button inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium"
              >
                <span>去开始课程</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        ) : (
          <div className="space-y-8">
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(["all", "highlight", "note", "capture"] as const).map((kind) => {
                const isActive = activeKind === kind;
                const Icon = kind === "all" ? FileText : KIND_META[kind].icon;

                return (
                  <Link
                    key={kind}
                    href={kind === "all" ? "/editor" : `/editor?kind=${kind}`}
                    className={`rounded-[26px] border px-4 py-4 transition-[transform,box-shadow] hover:-translate-y-0.5 ${
                      isActive
                        ? "border-black/10 bg-white shadow-[0_24px_56px_-40px_rgba(15,23,42,0.16)]"
                        : "border-transparent bg-[#f5f6f8]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="ui-icon-chip flex h-10 w-10 items-center justify-center">
                        <Icon className="h-4 w-4 text-[var(--color-text-secondary)]" />
                      </div>
                      <span className="text-2xl font-semibold text-[var(--color-text)]">
                        {snapshot.counts[kind]}
                      </span>
                    </div>
                    <div className="mt-4">
                      <div className="text-sm font-medium text-[var(--color-text)]">
                        {KIND_LABELS[kind]}
                      </div>
                      <p className="mt-1 text-xs leading-6 text-[var(--color-text-secondary)]">
                        {kind === "all" ? "跨课程查看全部知识沉淀" : KIND_META[kind].description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </section>

            {snapshot.courses.length > 0 && (
              <section>
                <div className="mb-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                    课程维度
                  </p>
                  <h2 className="mt-2 text-xl font-medium text-[var(--color-text)]">
                    按课程回看沉淀
                  </h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {snapshot.courses.slice(0, 6).map((course) => (
                    <Link
                      key={course.courseId}
                      href={`/editor?courseId=${course.courseId}`}
                      className="rounded-[26px] bg-white px-5 py-4 shadow-[0_24px_56px_-40px_rgba(15,23,42,0.14)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:[box-shadow:var(--shadow-soft-panel-hover)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-[var(--color-text)]">
                            {course.courseTitle}
                          </div>
                          <div className="mt-1 text-xs leading-6 text-[var(--color-text-secondary)]">
                            {course.noteCount} 条沉淀
                          </div>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-[var(--color-text-muted)]" />
                      </div>
                      <div className="mt-3 text-xs text-[var(--color-text-muted)]">
                        {formatDate(course.latestUpdatedAt)}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                    知识流
                  </p>
                  <h2 className="mt-2 text-xl font-medium text-[var(--color-text)]">
                    {courseId ? "当前课程的沉淀" : `${KIND_LABELS[activeKind]}视图`}
                  </h2>
                </div>
                {courseId && (
                  <Link
                    href={activeKind === "all" ? "/editor" : `/editor?kind=${activeKind}`}
                    className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                  >
                    清除课程筛选
                  </Link>
                )}
              </div>

              {filteredNotes.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-black/10 bg-[#fafafa] px-6 py-10 text-center text-sm text-[var(--color-text-secondary)]">
                  当前筛选下还没有内容。
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredNotes.map((note) => {
                    const source =
                      note.kind === "highlight"
                        ? "课程高亮"
                        : note.kind === "note"
                          ? "课程笔记"
                          : note.kind === "capture"
                            ? "对话沉淀"
                            : "手动笔记";
                    const sourceTitle =
                      note.sourceContext?.courseTitle && note.sourceContext.sectionTitle
                        ? `${note.sourceContext.courseTitle} · ${note.sourceContext.sectionTitle}`
                        : null;

                    return (
                      <Link
                        key={note.id}
                        href={`/editor/${note.id}`}
                        className="ui-surface-card group rounded-[28px] p-5 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:[box-shadow:var(--shadow-soft-panel-hover)]"
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="ui-badge-pill inline-flex items-center gap-2 px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
                              <FileText className="h-3.5 w-3.5" />
                              <span>{source}</span>
                            </div>
                            <h2 className="line-clamp-2 text-lg font-medium leading-7 text-[var(--color-text)]">
                              {note.title}
                            </h2>
                          </div>
                          <ArrowUpRight className="h-4 w-4 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </div>

                        {sourceTitle && (
                          <div className="mb-3 rounded-2xl bg-[#f4f6f8] px-3 py-2 text-xs leading-6 text-[var(--color-text-secondary)]">
                            {sourceTitle}
                          </div>
                        )}

                        <p className="line-clamp-4 text-sm leading-7 text-[var(--color-text-secondary)]">
                          {buildExcerpt(
                            note.plainText,
                            note.sourceContext?.selectionText ??
                              note.sourceContext?.latestExcerpt ??
                              null,
                          )}
                        </p>

                        <div className="mt-4 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                          <Clock3 className="h-3.5 w-3.5" />
                          <span>{formatDate(note.updatedAt)}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

export default function NotesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; courseId?: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--color-bg)]" />}>
      <NotesIndexPageContent searchParams={searchParams} />
    </Suspense>
  );
}
