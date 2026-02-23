"use client";

import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Editor } from "@/components/editor";
import {
  MobileEditorToolbar,
  MobileEditorMoreMenu,
} from "@/components/editor/MobileEditorToolbar";
import { MobileHeader } from "@/components/shared/layout";
import type { Editor as TiptapEditorType } from "@tiptap/react";

export default function EditorPage() {
  const params = useParams();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [editorInstance, setEditorInstance] = useState<TiptapEditorType | null>(null);

  useEffect(() => {
    const noteId = params.id as string;
    if (noteId) {
      // Mock load - 实际应调用 API
      setTimeout(() => {
        setTitle("我的笔记");
        setContent("<p>欢迎使用 NexusNote 编辑器</p>");
        setLoading(false);
      }, 500);
    }
  }, [params.id]);

  const handleSave = async () => {
    // TODO: 保存到数据库
    console.log("Saving:", { title, content });
    alert("已保存");
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex items-center justify-center min-h-screen"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-3 border-zinc-200 border-t-indigo-600 rounded-full"
        />
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-white md:bg-slate-50">
      {/* 移动端顶部导航 */}
      <MobileHeader
        title={title || "无标题"}
        showBack
        rightAction="custom"
        onRightAction={handleSave}
        className="md:hidden"
      />

      {/* 桌面端布局 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="hidden md:block max-w-3xl mx-auto px-6 py-8"
      >
        <header className="flex justify-between items-center mb-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="笔记标题"
            className="text-2xl font-bold bg-transparent border-none outline-none flex-1"
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            保存
          </motion.button>
        </header>
        <Editor content={content} onChange={setContent} placeholder="开始写作..." />
      </motion.div>

      {/* 移动端全屏编辑 */}
      <div className="md:hidden">
        {/* 移动端标题栏 */}
        <div className="px-4 pt-16 pb-2 border-b border-zinc-100">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="无标题"
            className="w-full text-lg font-semibold bg-transparent border-none outline-none"
          />
        </div>

        {/* 编辑区域 */}
        <div className="px-4 py-4 pb-24">
          <Editor
            content={content}
            onChange={setContent}
            placeholder="开始写作..."
            onReady={setEditorInstance}
          />
        </div>

        {/* 移动端工具栏 */}
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
