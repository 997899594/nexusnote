"use client";

import type { Editor as TiptapEditorType } from "@tiptap/react";
import { motion } from "framer-motion";
import { AlertCircle, ArrowUpRight, BookOpen, CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Editor } from "@/components/editor";
import { MobileEditorMoreMenu, MobileEditorToolbar } from "@/components/editor/MobileEditorToolbar";
import { MobileHeader } from "@/components/shared/layout";
import { TagBar, TagGenerationTrigger } from "@/components/tags";
import { useToast } from "@/components/ui/Toast";
import type { notes } from "@/db";

type NoteSourceContext = typeof notes.$inferSelect.sourceContext;
type SaveStatus = "saved" | "unsaved" | "saving" | "error";

interface EditorPageClientProps {
  noteId: string;
  initialTitle: string;
  initialContentHtml: string;
  initialUpdatedAt: string | null;
  sourceType: string;
  sourceContext: NoteSourceContext | null;
}

export default function EditorPageClient({
  noteId,
  initialTitle,
  initialContentHtml,
  initialUpdatedAt,
  sourceType,
  sourceContext,
}: EditorPageClientProps) {
  const [content, setContent] = useState(initialContentHtml);
  const [title, setTitle] = useState(initialTitle);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [editorInstance, setEditorInstance] = useState<TiptapEditorType | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(
    initialUpdatedAt ? new Date(initialUpdatedAt) : null,
  );
  const { addToast } = useToast();

  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasMountedRef = useRef(false);
  const lastSavedTitleRef = useRef(initialTitle.trim() || "Untitled");
  const lastSavedContentRef = useRef(initialContentHtml);

  const normalizedTitle = useMemo(() => title.trim() || "Untitled", [title]);
  const isDirty =
    normalizedTitle !== lastSavedTitleRef.current || content !== lastSavedContentRef.current;

  const sourceSummary = useMemo(() => {
    if (
      sourceType !== "course_capture" ||
      !sourceContext?.courseTitle ||
      !sourceContext.sectionTitle
    ) {
      return null;
    }

    return {
      courseTitle: sourceContext.courseTitle,
      sectionTitle: sourceContext.sectionTitle,
      href: sourceContext.courseId ? `/learn/${sourceContext.courseId}` : null,
      selectionPreview: sourceContext.selectionText
        ? truncateText(sourceContext.selectionText.replace(/\s+/g, " ").trim(), 140)
        : null,
    };
  }, [sourceContext, sourceType]);

  const saveLabel = useMemo(() => {
    switch (saveStatus) {
      case "saving":
        return "保存中...";
      case "error":
        return "保存失败";
      case "unsaved":
        return "已更改";
      default:
        return lastSavedAt ? `已保存 ${formatSavedTime(lastSavedAt)}` : "已保存";
    }
  }, [lastSavedAt, saveStatus]);

  const performSave = useCallback(
    async ({ showToast = false }: { showToast?: boolean } = {}) => {
      if (!isDirty) {
        setSaveStatus("saved");
        return true;
      }

      setSaveStatus("saving");

      try {
        const response = await fetch(`/api/notes/${noteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: normalizedTitle,
            contentHtml: content,
          }),
        });

        if (!response.ok) {
          throw new Error("保存失败");
        }

        const { note } = (await response.json()) as {
          note: { updatedAt: string | null };
        };

        lastSavedTitleRef.current = normalizedTitle;
        lastSavedContentRef.current = content;
        setLastSavedAt(note.updatedAt ? new Date(note.updatedAt) : new Date());
        setSaveStatus("saved");

        if (showToast) {
          addToast("笔记已保存", "success");
        }

        return true;
      } catch {
        setSaveStatus("error");

        if (showToast) {
          addToast("笔记保存失败，请稍后重试", "error");
        }

        return false;
      }
    },
    [addToast, content, isDirty, normalizedTitle, noteId],
  );

  const handleSave = useCallback(async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    await performSave({ showToast: true });
  }, [performSave]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    if (!isDirty) {
      if (saveStatus !== "saving") {
        setSaveStatus("saved");
      }
      return;
    }

    setSaveStatus((current) => (current === "saving" ? current : "unsaved"));
    autosaveTimerRef.current = setTimeout(() => {
      void performSave();
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [isDirty, performSave, saveStatus]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const saveStatusNode = (
    <div className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
      {saveStatus === "saving" ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : saveStatus === "error" ? (
        <AlertCircle className="h-4 w-4 text-rose-500" />
      ) : (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      )}
      <span>{saveLabel}</span>
    </div>
  );

  const sourceCard = sourceSummary ? (
    <div className="rounded-[22px] bg-[#f4f6f8] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)]">
            <BookOpen className="h-3.5 w-3.5" />
            <span>来自课程沉淀</span>
          </div>
          <div className="text-sm font-medium text-[var(--color-text)]">
            {sourceSummary.courseTitle} · {sourceSummary.sectionTitle}
          </div>
          {sourceSummary.selectionPreview && (
            <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
              “{sourceSummary.selectionPreview}”
            </p>
          )}
        </div>
        {sourceSummary.href && (
          <Link
            href={sourceSummary.href}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-text)] shadow-[0_16px_32px_-28px_rgba(15,23,42,0.22)] transition-colors hover:bg-[#eef1f5]"
          >
            <span>查看课程</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <MobileHeader
        title={title || "无标题"}
        showBack
        backConfirm={isDirty}
        rightAction="custom"
        rightLabel={saveStatus === "saving" ? "保存中..." : "保存"}
        onRightAction={handleSave}
        className="md:hidden"
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto hidden max-w-4xl px-6 py-8 md:block"
      >
        <div className="rounded-[28px] bg-white px-8 py-8 shadow-[0_28px_64px_-42px_rgba(15,23,42,0.18)]">
          <header className="mb-6 flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1 space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="笔记标题"
                className="w-full border-none bg-transparent text-[1.75rem] font-semibold tracking-tight text-[var(--color-text)] outline-none"
              />
              {saveStatusNode}
              {sourceCard}
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              className="rounded-2xl bg-[#111827] px-5 py-2.5 text-sm font-medium text-white shadow-[0_18px_36px_-26px_rgba(15,23,42,0.32)] transition-transform disabled:opacity-60"
            >
              {saveStatus === "saving" ? "保存中..." : "保存"}
            </motion.button>
          </header>
          <TagBar noteId={noteId} />
          <Editor content={content} onChange={setContent} placeholder="开始写作..." />
          <TagGenerationTrigger noteId={noteId} content={content} />
        </div>
      </motion.div>

      <div className="md:hidden">
        <div className="px-4 pb-4 pt-16">
          <div className="space-y-4 rounded-[24px] bg-white px-4 py-4 shadow-[0_24px_56px_-40px_rgba(15,23,42,0.18)]">
            <div className="space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="无标题"
                className="w-full border-none bg-transparent text-lg font-semibold text-[var(--color-text)] outline-none"
              />
              {saveStatusNode}
              {sourceCard}
            </div>
            <TagBar noteId={noteId} />
          </div>
        </div>

        <div className="px-4 pb-24">
          <div className="rounded-[24px] bg-white px-4 py-5 shadow-[0_24px_56px_-40px_rgba(15,23,42,0.18)]">
            <Editor
              content={content}
              onChange={setContent}
              placeholder="开始写作..."
              onReady={setEditorInstance}
            />
          </div>
        </div>

        <TagGenerationTrigger noteId={noteId} content={content} />

        {editorInstance && (
          <>
            <MobileEditorToolbar
              editor={editorInstance}
              onMoreClick={() => setShowMoreMenu(true)}
            />
            <MobileEditorMoreMenu
              editor={editorInstance}
              isOpen={showMoreMenu}
              onClose={() => setShowMoreMenu(false)}
            />
          </>
        )}
      </div>
    </div>
  );
}

function truncateText(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max).trim()}...` : value;
}

function formatSavedTime(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
