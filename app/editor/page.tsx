import {
  ArrowUpRight,
  BookOpen,
  Brain,
  Clock3,
  Compass,
  FileText,
  Highlighter,
  Layers3,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { KnowledgeInsightStrip } from "@/components/knowledge/KnowledgeInsightStrip";
import { FloatingHeader, LibraryAnalysisPageShell } from "@/components/shared/layout";
import { requireDynamicPageAuth } from "@/lib/auth/page";
import { getCareerNodeStateLabel } from "@/lib/career-tree/presentation";
import { buildKnowledgeExcerpt, getKnowledgeInsightKindLabel } from "@/lib/knowledge/presentation";
import { getNotesWorkbenchCached } from "@/lib/knowledge/workbench-data";
import type { NoteWorkbenchItem, NoteWorkbenchKind } from "@/lib/knowledge/workbench-projection";

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
  capture: "对话",
  manual: "手动",
};

const KIND_META = {
  highlight: { icon: Highlighter, description: "从课程里直接划线留下的重点" },
  note: { icon: NotebookPen, description: "带有自己理解和补充说明的课程笔记" },
  capture: { icon: Sparkles, description: "从学习对话保存下来的结构化笔记" },
  manual: { icon: FileText, description: "手动创建或通过编辑动作生成的笔记" },
} as const;

function getNoteSourceLabel(note: NoteWorkbenchItem): string {
  switch (note.kind) {
    case "highlight":
      return "课程高亮";
    case "note":
      return "课程笔记";
    case "capture":
      return "对话笔记";
    case "manual":
      return "手动笔记";
  }
}

function matchesNoteWorkbenchFilters(
  note: NoteWorkbenchItem,
  activeKind: NoteWorkbenchKind,
  courseId?: string,
): boolean {
  const matchesKind = activeKind === "all" || note.kind === activeKind;
  const matchesCourse = !courseId || note.sourceContext?.courseId === courseId;
  return matchesKind && matchesCourse;
}

function resolveFilteredItems(params: {
  itemIds: string[];
  itemById: Map<string, NoteWorkbenchItem>;
  activeKind: NoteWorkbenchKind;
  courseId?: string;
  limit: number;
}): NoteWorkbenchItem[] {
  return params.itemIds
    .map((itemId) => params.itemById.get(itemId))
    .filter((item): item is NoteWorkbenchItem => Boolean(item))
    .filter((item) => matchesNoteWorkbenchFilters(item, params.activeKind, params.courseId))
    .slice(0, params.limit);
}

function getEditorKindHref(kind: NoteWorkbenchKind): string {
  return kind === "all" ? "/editor" : `/editor?kind=${kind}`;
}

function NoteCard({ note, emphasize = false }: { note: NoteWorkbenchItem; emphasize?: boolean }) {
  const sourceTitle =
    note.sourceContext?.courseTitle && note.sourceContext.sectionTitle
      ? `${note.sourceContext.courseTitle} · ${note.sourceContext.sectionTitle}`
      : null;

  return (
    <Link
      href={`/editor/${note.id}`}
      className={`group rounded-[28px] p-5 transition-shadow ${
        emphasize
          ? "ui-message-card border border-black/8"
          : "ui-surface-card hover:[box-shadow:var(--shadow-soft-panel-hover)]"
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="ui-badge-pill inline-flex items-center gap-2 px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
              <FileText className="h-3.5 w-3.5" />
              <span>{getNoteSourceLabel(note)}</span>
            </div>
            {note.isFocusRelated ? (
              <div className="ui-primary-button inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]">
                <Compass className="h-3 w-3" />
                当前焦点
              </div>
            ) : null}
            {note.insightKinds.slice(0, 2).map((kind) => (
              <div
                key={`${note.id}-${kind}`}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-panel-soft)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]"
              >
                <Brain className="h-3 w-3" />
                {getKnowledgeInsightKindLabel(kind)}
              </div>
            ))}
          </div>
          <h2 className="line-clamp-2 text-lg font-medium leading-7 text-[var(--color-text)]">
            {note.title}
          </h2>
        </div>
        <ArrowUpRight className="h-4 w-4 text-[var(--color-text-muted)]" />
      </div>

      {sourceTitle && (
        <div className="mb-3 rounded-2xl bg-[var(--color-panel-soft)] px-3 py-2 text-xs leading-6 text-[var(--color-text-secondary)]">
          {sourceTitle}
        </div>
      )}

      <p className="line-clamp-4 text-sm leading-7 text-[var(--color-text-secondary)]">
        {buildKnowledgeExcerpt(
          note.plainText,
          note.sourceContext?.selectionText ?? note.sourceContext?.latestExcerpt ?? null,
          { emptyText: "课程里的重点会出现在这里。" },
        )}
      </p>

      <div className="mt-4 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Clock3 className="h-3.5 w-3.5" />
        <span>{formatDate(note.updatedAt)}</span>
      </div>
    </Link>
  );
}

async function NotesIndexPageContent({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; courseId?: string }>;
}) {
  const session = await requireDynamicPageAuth("/editor");
  const { kind: rawKind, courseId } = await searchParams;
  const snapshot = await getNotesWorkbenchCached(session.user.id);
  const activeKind = (rawKind as NoteWorkbenchKind | undefined) ?? "all";
  const insights = snapshot.insights.slice(0, 3);
  const itemById = new Map(snapshot.items.map((item) => [item.id, item]));
  const filteredNotes = snapshot.items.filter((note) =>
    matchesNoteWorkbenchFilters(note, activeKind, courseId),
  );
  const focusItems = snapshot.focus
    ? resolveFilteredItems({
        itemIds: snapshot.focus.relatedItemIds,
        itemById,
        activeKind,
        courseId,
        limit: 3,
      })
    : [];
  const insightCollections = snapshot.insightGroups
    .map((group) => ({
      ...group,
      items: resolveFilteredItems({
        itemIds: group.itemIds,
        itemById,
        activeKind,
        courseId,
        limit: 3,
      }),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <LibraryAnalysisPageShell
      header={
        <FloatingHeader showBackHint title="知识工作台" subtitle="Editor" variant="workspace" />
      }
      frameClassName="max-w-5xl"
    >
      <header className="mb-8 max-w-3xl md:mb-10">
        <div className="ui-badge-pill ui-page-eyebrow inline-flex items-center gap-2 px-3 py-1.5 text-[11px] uppercase tracking-[0.22em]">
          <span className="ui-strong-chip h-1.5 w-1.5 rounded-full" />
          学习笔记
        </div>
        <h1 className="ui-page-title mt-4 text-3xl font-semibold tracking-[-0.05em] md:text-5xl">
          跨课程知识工作台
        </h1>
        <p className="ui-page-description mt-3 max-w-2xl text-base leading-8">
          把高亮、课程笔记和对话笔记放在一起，不再困在单门课程里。
        </p>
      </header>

      {insights.length > 0 ? (
        <section className="mb-8">
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
              AI 洞察
            </p>
            <h2 className="mt-2 text-xl font-medium text-[var(--color-text)]">
              最近整理出的知识线索
            </h2>
          </div>
          <KnowledgeInsightStrip insights={insights} />
        </section>
      ) : null}

      {snapshot.items.length === 0 ? (
        <section className="ui-surface-card-lg rounded-[32px] p-8 md:p-10">
          <div className="flex max-w-xl flex-col items-start gap-4">
            <div className="ui-icon-chip flex h-12 w-12 items-center justify-center">
              <BookOpen className="h-5 w-5 text-[var(--color-text-secondary)]" />
            </div>
            <div>
              <h2 className="text-xl font-medium text-[var(--color-text)]">还没有学习笔记</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
                在课程里选中重点内容，点击“记一笔”，就会保存成带来源的学习笔记。
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
          {snapshot.focus ? (
            <section className="ui-message-card overflow-hidden rounded-[32px] p-5 md:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                    <Compass className="h-4 w-4" />
                    当前焦点
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                    {snapshot.focus.title}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
                    {snapshot.focus.summary}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--color-text-secondary)]">
                    <span className="ui-badge-pill rounded-full px-3 py-1.5">
                      进度 {snapshot.focus.progress}%
                    </span>
                    <span className="ui-badge-pill rounded-full px-3 py-1.5">
                      {getCareerNodeStateLabel(snapshot.focus.state)}
                    </span>
                    <span className="ui-badge-pill rounded-full px-3 py-1.5">
                      相关材料 {snapshot.focus.relatedItemIds.length} 条
                    </span>
                  </div>
                </div>
                <div className="ui-message-card rounded-[24px] px-4 py-4 text-sm leading-7 text-[var(--color-text-secondary)] lg:max-w-sm">
                  这里优先展示和你当前学习焦点真正有关的笔记。
                </div>
              </div>

              {focusItems.length > 0 ? (
                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {focusItems.map((note) => (
                    <NoteCard key={note.id} note={note} emphasize />
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-[24px] border border-dashed border-black/10 bg-[var(--color-panel-soft)] px-5 py-6 text-sm text-[var(--color-text-secondary)]">
                  当前筛选下还没有和这个焦点直接关联的材料。
                </div>
              )}
            </section>
          ) : null}

          {insightCollections.length > 0 ? (
            <section>
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
                  关联主题
                </p>
                <h2 className="mt-2 text-xl font-medium text-[var(--color-text)]">
                  按主题把相关材料放在一起
                </h2>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {insightCollections.map((group) => (
                  <div key={group.insight.id} className="ui-message-card rounded-[28px] px-5 py-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                          <Layers3 className="h-3.5 w-3.5" />
                          {getKnowledgeInsightKindLabel(group.insight.kind)}
                        </div>
                        <h3 className="mt-3 text-lg font-medium text-[var(--color-text)]">
                          {group.insight.title}
                        </h3>
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">
                        {Math.round(group.insight.confidence * 100)}%
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[var(--color-text-secondary)]">
                      {group.insight.summary}
                    </p>
                    <div className="mt-4 space-y-3">
                      {group.items.map((note) => (
                        <Link
                          key={note.id}
                          href={`/editor/${note.id}`}
                          className="block rounded-[20px] bg-[var(--color-panel-soft)] px-4 py-3 transition-colors hover:bg-[var(--color-active)]"
                        >
                          <div className="text-sm font-medium text-[var(--color-text)]">
                            {note.title}
                          </div>
                          <div className="mt-1 text-xs leading-6 text-[var(--color-text-secondary)]">
                            {buildKnowledgeExcerpt(
                              note.plainText,
                              note.sourceContext?.selectionText ??
                                note.sourceContext?.latestExcerpt ??
                                null,
                              { emptyText: "课程里的重点会出现在这里。" },
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(["all", "highlight", "note", "capture"] as const).map((kind) => {
              const isActive = activeKind === kind;
              const Icon = kind === "all" ? FileText : KIND_META[kind].icon;

              return (
                <Link
                  key={kind}
                  href={getEditorKindHref(kind)}
                  className={`rounded-[26px] border px-4 py-4 transition-shadow ${
                    isActive
                      ? "ui-message-card border-black/10"
                      : "border-transparent bg-[var(--color-panel-soft)]"
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
                      {kind === "all" ? "跨课程查看全部学习笔记" : KIND_META[kind].description}
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
                  按课程回看笔记
                </h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {snapshot.courses.slice(0, 6).map((course) => (
                  <Link
                    key={course.courseId}
                    href={`/editor?courseId=${course.courseId}`}
                    className="ui-message-card rounded-[26px] px-5 py-4 transition-shadow hover:[box-shadow:var(--shadow-soft-panel-hover)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-[var(--color-text)]">
                          {course.courseTitle}
                        </div>
                        <div className="mt-1 text-xs leading-6 text-[var(--color-text-secondary)]">
                          {course.noteCount} 条笔记
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
                  {courseId ? "当前课程的笔记" : `${KIND_LABELS[activeKind]}视图`}
                </h2>
              </div>
              {courseId && (
                <Link
                  href={getEditorKindHref(activeKind)}
                  className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                >
                  清除课程筛选
                </Link>
              )}
            </div>

            {filteredNotes.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-black/10 bg-[var(--color-panel-soft)] px-6 py-10 text-center text-sm text-[var(--color-text-secondary)]">
                当前筛选下还没有内容。
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredNotes.map((note) => (
                  <NoteCard key={note.id} note={note} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </LibraryAnalysisPageShell>
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
