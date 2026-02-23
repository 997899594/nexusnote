/**
 * MobileEditorToolbar - 移动端编辑器底部工具栏
 *
 * 功能:
 * - 固定在底部
 * - 4-5 个核心格式按钮
 * - 滚动显示更多按钮
 * - 支持长按展开更多选项
 */

"use client";

import { motion } from "framer-motion";
import {
  Bold,
  Code,
  Heading1,
  Italic,
  List,
  ListOrdered,
  MoreHorizontal,
  Quote,
  Redo,
  Strikethrough,
  Undo,
} from "lucide-react";
import type { Editor as TiptapEditorType } from "@tiptap/react";
import { useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";

export interface MobileEditorToolbarProps {
  editor: TiptapEditorType | null;
  onMoreClick?: () => void;
}

const basicFormatButtons = [
  { icon: Bold, label: "粗体", action: "bold" },
  { icon: Italic, label: "斜体", action: "italic" },
  { icon: Strikethrough, label: "删除线", action: "strike" },
  { icon: Heading1, label: "标题", action: "heading" },
  { icon: List, label: "列表", action: "bulletList" },
];

const moreButtons = [
  { icon: ListOrdered, label: "有序列表", action: "orderedList" },
  { icon: Quote, label: "引用", action: "blockquote" },
  { icon: Code, label: "代码", action: "codeBlock" },
  { icon: Undo, label: "撤销", action: "undo" },
  { icon: Redo, label: "重做", action: "redo" },
];

export function MobileEditorToolbar({ editor, onMoreClick }: MobileEditorToolbarProps) {
  const handleAction = useCallback(
    (action: string) => {
      if (!editor) return;

      switch (action) {
        case "bold":
          editor.chain().focus().toggleBold().run();
          break;
        case "italic":
          editor.chain().focus().toggleItalic().run();
          break;
        case "strike":
          editor.chain().focus().toggleStrike().run();
          break;
        case "heading":
          editor.chain().focus().toggleHeading({ level: 1 }).run();
          break;
        case "bulletList":
          editor.chain().focus().toggleBulletList().run();
          break;
        case "orderedList":
          editor.chain().focus().toggleOrderedList().run();
          break;
        case "blockquote":
          editor.chain().focus().toggleBlockquote().run();
          break;
        case "codeBlock":
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case "undo":
          editor.chain().focus().undo().run();
          break;
        case "redo":
          editor.chain().focus().redo().run();
          break;
      }
    },
    [editor]
  );

  const isActive = useCallback(
    (action: string) => {
      if (!editor) return false;
      switch (action) {
        case "bold":
          return editor.isActive("bold");
        case "italic":
          return editor.isActive("italic");
        case "strike":
          return editor.isActive("strike");
        case "heading":
          return editor.isActive("heading");
        case "bulletList":
          return editor.isActive("bulletList");
        case "orderedList":
          return editor.isActive("orderedList");
        case "blockquote":
          return editor.isActive("blockquote");
        case "codeBlock":
          return editor.isActive("codeBlock");
        default:
          return false;
      }
    },
    [editor]
  );

  const basicButtons = useMemo(() => {
    return basicFormatButtons.map((btn) => {
      const Icon = btn.icon;
      const active = isActive(btn.action);

      return (
        <motion.button
          key={btn.action}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleAction(btn.action)}
          className={cn(
            "touch-target flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-colors min-w-[56px]",
            active
              ? "bg-indigo-100 text-indigo-700"
              : "text-zinc-600 hover:bg-zinc-100"
          )}
          aria-label={btn.label}
        >
          <Icon className="w-5 h-5" />
          <span className="text-[10px] font-medium">{btn.label}</span>
        </motion.button>
      );
    });
  }, [handleAction, isActive]);

  if (!editor) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-zinc-200/40 safe-bottom md:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {basicButtons}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onMoreClick}
          className="touch-target flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-zinc-600 hover:bg-zinc-100 min-w-[56px]"
          aria-label="更多"
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] font-medium">更多</span>
        </motion.button>
      </div>
    </div>
  );
}

export interface MobileEditorMoreMenuProps {
  editor: TiptapEditorType | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MobileEditorMoreMenu({ editor, isOpen, onClose }: MobileEditorMoreMenuProps) {
  const handleAction = useCallback(
    (action: string) => {
      if (!editor) return;

      switch (action) {
        case "orderedList":
          editor.chain().focus().toggleOrderedList().run();
          break;
        case "blockquote":
          editor.chain().focus().toggleBlockquote().run();
          break;
        case "codeBlock":
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case "undo":
          editor.chain().focus().undo().run();
          break;
        case "redo":
          editor.chain().focus().redo().run();
          break;
      }
      onClose();
    },
    [editor, onClose]
  );

  if (!isOpen || !editor) return null;

  return (
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 z-40 bg-black/20 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* 菜单 */}
      <motion.div
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 200, opacity: 0 }}
        className="fixed bottom-16 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl p-4 md:hidden"
      >
        <div className="grid grid-cols-5 gap-2">
          {moreButtons.map((btn) => {
            const Icon = btn.icon;
            return (
              <motion.button
                key={btn.action}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleAction(btn.action)}
                className="touch-target flex flex-col items-center justify-center gap-1 p-3 rounded-xl text-zinc-600 hover:bg-zinc-100"
                aria-label={btn.label}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{btn.label}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </>
  );
}

export default MobileEditorToolbar;
