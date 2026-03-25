"use client";

import type { Editor as TiptapEditorType } from "@tiptap/react";
import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Editor } from "@/components/editor";
import { MobileEditorMoreMenu, MobileEditorToolbar } from "@/components/editor/MobileEditorToolbar";
import { MobileHeader } from "@/components/shared/layout";
import { TagBar, TagGenerationTrigger } from "@/components/tags";

export default function EditorPageClient() {
  const params = useParams();
  const noteId = params.id as string;
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [editorInstance, setEditorInstance] = useState<TiptapEditorType | null>(null);

  useEffect(() => {
    if (noteId) {
      const timer = setTimeout(() => {
        setTitle("我的笔记");
        setContent("<p>欢迎使用 NexusNote 编辑器</p>");
        setLoading(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [noteId]);

  const handleSave = async () => {
    console.log("Saving:", { title, content });
    alert("已保存");
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex min-h-screen items-center justify-center bg-[#f6f7f9]"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-8 w-8 rounded-full border-[3px] border-[#d7dde6] border-t-[#111827]"
        />
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <MobileHeader
        title={title || "无标题"}
        showBack
        rightAction="custom"
        rightLabel="保存"
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
          <header className="mb-6 flex items-center justify-between gap-6">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="笔记标题"
              className="flex-1 border-none bg-transparent text-[1.75rem] font-semibold tracking-tight text-[var(--color-text)] outline-none"
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              className="rounded-2xl bg-[#111827] px-5 py-2.5 text-sm font-medium text-white shadow-[0_18px_36px_-26px_rgba(15,23,42,0.32)] transition-transform"
            >
              保存
            </motion.button>
          </header>
          <TagBar noteId={noteId} />
          <Editor content={content} onChange={setContent} placeholder="开始写作..." />
          <TagGenerationTrigger noteId={noteId} content={content} />
        </div>
      </motion.div>

      <div className="md:hidden">
        <div className="px-4 pb-4 pt-16">
          <div className="rounded-[24px] bg-white px-4 py-4 shadow-[0_24px_56px_-40px_rgba(15,23,42,0.18)]">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="无标题"
              className="w-full border-none bg-transparent text-lg font-semibold text-[var(--color-text)] outline-none"
            />
            <div className="pt-3">
              <TagBar noteId={noteId} />
            </div>
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
