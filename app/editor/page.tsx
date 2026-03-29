import { desc, eq } from "drizzle-orm";
import { ArrowUpRight, BookOpen, Clock3, FileText } from "lucide-react";
import Link from "next/link";
import { db, notes } from "@/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

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

export default async function NotesIndexPage() {
  const session = await requireAuth("/editor");
  const recentNotes = await db.query.notes.findMany({
    where: eq(notes.userId, session.user.id),
    orderBy: desc(notes.updatedAt),
    limit: 24,
  });

  return (
    <main className="ui-page-shell min-h-dvh safe-top">
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-24 md:px-6 md:pb-24 md:pt-24">
        <header className="mb-8 max-w-3xl md:mb-10">
          <div className="ui-badge-pill inline-flex items-center gap-2 px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-black/45">
            <span className="ui-strong-chip h-1.5 w-1.5 rounded-full" />
            学习笔记
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-black/90 md:text-5xl">
            最近沉淀的笔记
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-8 text-black/55">
            从课程里划线沉淀下来的内容都会收在这里，后续可以继续整理、改写和搜索。
          </p>
        </header>

        {recentNotes.length === 0 ? (
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
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recentNotes.map((note) => {
              const source = note.sourceType === "course_capture" ? "课程沉淀" : "笔记";
              const sourceTitle =
                note.sourceType === "course_capture" &&
                note.sourceContext?.courseTitle &&
                note.sourceContext.sectionTitle
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
                    {buildExcerpt(note.plainText, note.sourceContext?.selectionText ?? null)}
                  </p>

                  <div className="mt-4 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <Clock3 className="h-3.5 w-3.5" />
                    <span>{formatDate(note.updatedAt)}</span>
                  </div>
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
