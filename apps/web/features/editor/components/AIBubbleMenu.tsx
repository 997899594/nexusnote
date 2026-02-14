"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { AnimatePresence, motion } from "framer-motion";
import { BookmarkPlus, Brain, Check, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AI_ACTIONS, type AIAction, useInlineAI } from "@/features/editor/hooks/useInlineAI";
import { CreateFlashcardDialog } from "@/features/learning/components/srs/CreateFlashcardDialog";
import { useNoteExtractionOptional } from "@/lib/store";
import { GhostFlight } from "./GhostFlight";

interface AIBubbleMenuProps {
  editor: Editor;
  documentId?: string;
  chapterId?: string;
}

interface FlyingNote {
  id: string;
  content: string;
  startRect: DOMRect;
}

export function AIBubbleMenu({ editor, documentId, chapterId }: AIBubbleMenuProps) {
  const [showAI, setShowAI] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showFlashcardDialog, setShowFlashcardDialog] = useState(false);
  const [flashcardSelection, setFlashcardSelection] = useState("");
  const [flyingNotes, setFlyingNotes] = useState<FlyingNote[]>([]);
  const { completion, isLoading, runAction, stop, reset } = useInlineAI();

  // Note extraction context (optional - may not be available)
  const noteExtraction = useNoteExtractionOptional();

  // 获取选中的文本
  const getSelectedText = useCallback(() => {
    if (!editor.state) return "";
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, " ");
  }, [editor]);

  // 执行 AI 操作
  const handleAction = async (action: AIAction) => {
    const selection = getSelectedText();
    if (!selection) return;

    setShowAI(false);
    setShowResult(true);
    reset();
    await runAction(action, selection);
  };

  // 应用结果
  const applyResult = useCallback(() => {
    if (!completion) return;

    editor.chain().focus().deleteSelection().insertContent(completion).run();
    setShowResult(false);
    reset();
  }, [editor, completion, reset]);

  // 取消
  const cancel = useCallback(() => {
    stop();
    setShowResult(false);
    reset();
  }, [stop, reset]);

  // 提取笔记到知识库
  const handleExtractNote = useCallback(() => {
    if (!noteExtraction) {
      console.warn("[AIBubbleMenu] NoteExtraction context not available");
      return;
    }

    if (!editor.state) {
      console.warn("[AIBubbleMenu] Editor state not available");
      return;
    }

    const { from, to } = editor.state.selection;
    if (from === to) return;

    const content = editor.state.doc.textBetween(from, to, " ");
    if (content.length < 10) {
      console.warn("[AIBubbleMenu] Selection too short to extract");
      return;
    }

    // Get the selection rect for animation
    const selection = window.getSelection();
    const range = selection?.getRangeAt(0);
    const rect = range?.getBoundingClientRect();

    if (!rect) return;

    // Create flying note for animation
    const tempId = crypto.randomUUID();
    setFlyingNotes((prev) => [...prev, { id: tempId, content, startRect: rect }]);

    // Determine source type
    const sourceType = chapterId ? "learning" : "document";

    // Trigger extraction
    noteExtraction.extractNote(content, rect, {
      sourceType,
      documentId,
      chapterId,
      position: { from, to },
    });
  }, [editor, noteExtraction, documentId, chapterId]);

  // Clear flying note after animation
  const handleFlightComplete = useCallback((noteId: string) => {
    setFlyingNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  // ESC 关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowAI(false);
        setShowResult(false);
        reset();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [reset]);

  return (
    <>
      {/* 基础气泡菜单 */}
      <BubbleMenu
        editor={editor}
        shouldShow={({ state }) => {
          // 有选中文本且不在显示结果时才显示
          const { from, to } = state.selection;
          return from !== to && !showResult;
        }}
        // @ts-expect-error - tippyOptions property mismatch in some Tiptap versions
        tippyOptions={{ duration: 300 }}
      >
        <div className="flex items-center gap-0.5 bg-white/70 backdrop-blur-3xl border border-black/[0.03] rounded-[20px] shadow-2xl shadow-black/5 p-1 ring-1 ring-black/[0.02]">
          {/* 常规格式化按钮 */}
          {[
            {
              id: "bold",
              label: "B",
              icon: null,
              action: () => editor.chain().focus().toggleBold().run(),
            },
            {
              id: "italic",
              label: "I",
              icon: null,
              action: () => editor.chain().focus().toggleItalic().run(),
            },
            {
              id: "code",
              label: "</>",
              icon: null,
              action: () => editor.chain().focus().toggleCode().run(),
            },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={btn.action}
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-300 ${
                editor.isActive(btn.id)
                  ? "bg-black text-white shadow-lg shadow-black/10 scale-105"
                  : "text-black/40 hover:text-black hover:bg-black/5"
              }`}
            >
              <span
                className={`text-xs font-black ${btn.id === "italic" ? "italic" : btn.id === "code" ? "font-mono" : ""}`}
              >
                {btn.label}
              </span>
            </button>
          ))}

          <div className="w-[1px] h-4 bg-black/[0.06] mx-1.5" />

          {/* AI 按钮 */}
          <button
            onClick={() => setShowAI(!showAI)}
            className={`flex items-center gap-2 px-3 h-9 rounded-xl transition-all duration-300 ${
              showAI
                ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                : "text-violet-600 hover:bg-violet-600/5"
            }`}
          >
            <Sparkles className={`w-4 h-4 ${showAI ? "animate-pulse" : ""}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">Magic AI</span>
          </button>

          <div className="w-[1px] h-4 bg-black/[0.06] mx-1.5" />

          {/* 创建卡片按钮 */}
          <button
            onClick={() => {
              const text = getSelectedText();
              if (text) {
                setFlashcardSelection(text);
                setShowFlashcardDialog(true);
              }
            }}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-black/40 hover:text-black hover:bg-black/5 transition-all duration-300"
            title="创建闪卡"
          >
            <Brain className="w-4 h-4" />
          </button>

          {/* 提取到知识库按钮 */}
          {noteExtraction && (
            <button
              onClick={handleExtractNote}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-emerald-600 hover:bg-emerald-600/5 transition-all duration-300"
              title="提取到知识库"
            >
              <BookmarkPlus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* AI 操作菜单 - Redesigned */}
        {showAI && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute top-full left-0 mt-3 bg-white/80 backdrop-blur-3xl border border-black/[0.03] rounded-[24px] shadow-2xl shadow-black/10 p-2 min-w-[200px] z-50 ring-1 ring-black/[0.02]"
          >
            {(Object.entries(AI_ACTIONS) as [AIAction, { label: string; icon: string }][]).map(
              ([action, { label, icon }]) => (
                <button
                  key={action}
                  onClick={() => handleAction(action)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-black/60 hover:text-black hover:bg-black/5 rounded-2xl transition-all group"
                >
                  <span className="text-lg group-hover:scale-125 transition-transform duration-500">
                    {icon}
                  </span>
                  <span>{label}</span>
                </button>
              ),
            )}
          </motion.div>
        )}
      </BubbleMenu>

      {/* AI 结果浮层 - Redesigned */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-black/[0.05]"
            >
              <div className="p-8 border-b border-black/[0.03] flex items-center justify-between bg-black text-white">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 leading-none">
                      AI Insight
                    </span>
                    <h3 className="text-lg font-black tracking-tight mt-1">智能处理结果</h3>
                  </div>
                </div>
                <button
                  onClick={cancel}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-10 min-h-[200px] max-h-[50vh] overflow-y-auto custom-scrollbar">
                {isLoading && !completion ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-black/5 border-t-black animate-spin" />
                    <span className="text-xs font-black uppercase tracking-widest text-black/20">
                      正在思考中...
                    </span>
                  </div>
                ) : (
                  <div className="prose prose-neutral max-w-none">
                    <p className="text-lg font-medium leading-relaxed text-black/80 whitespace-pre-wrap">
                      {completion}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-black/[0.03] flex items-center justify-between bg-black/[0.01]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-black/30">
                    Generation Ready
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {isLoading ? (
                    <button
                      onClick={stop}
                      className="px-6 py-3 text-[11px] font-black uppercase tracking-widest bg-rose-500 text-white rounded-2xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
                    >
                      停止生成
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={cancel}
                        className="px-6 py-3 text-[11px] font-black uppercase tracking-widest text-black/40 hover:text-black hover:bg-black/5 rounded-2xl transition-all"
                      >
                        放弃修改
                      </button>
                      <button
                        onClick={applyResult}
                        disabled={!completion}
                        className="flex items-center gap-3 px-8 py-3 bg-black text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/10 disabled:opacity-20"
                      >
                        <Check className="w-4 h-4" />
                        替换选中文本
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 创建闪卡对话框 */}
      <CreateFlashcardDialog
        isOpen={showFlashcardDialog}
        onClose={() => setShowFlashcardDialog(false)}
        initialFront={flashcardSelection}
      />

      {/* 幽灵飞梭动画 */}
      <AnimatePresence>
        {flyingNotes.map((note) => (
          <GhostFlight
            key={note.id}
            id={note.id}
            content={note.content}
            startRect={note.startRect}
            onComplete={() => handleFlightComplete(note.id)}
          />
        ))}
      </AnimatePresence>
    </>
  );
}
