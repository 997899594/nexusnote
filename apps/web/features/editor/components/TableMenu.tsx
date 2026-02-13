"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Merge,
  Minus,
  Plus,
  Split,
  Trash2,
} from "lucide-react";

interface TableMenuProps {
  editor: Editor;
}

export function TableMenu({ editor }: TableMenuProps) {
  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor }) => {
        return editor.isActive("table");
      }}
      // @ts-expect-error - tippyOptions property mismatch in some Tiptap versions
      tippyOptions={{ duration: 300 }}
    >
      <div className="flex items-center gap-0.5 bg-white/70 backdrop-blur-3xl border border-black/[0.03] rounded-[20px] shadow-2xl shadow-black/5 p-1 ring-1 ring-black/[0.02]">
        {/* 添加列 */}
        <button
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-black/40 hover:text-black hover:bg-black/5 transition-all duration-300"
          title="Add column after"
        >
          <div className="relative">
            <ArrowRight className="w-3 h-3" />
            <Plus className="w-2 h-2 absolute -top-1 -right-1" />
          </div>
        </button>

        {/* 添加行 */}
        <button
          onClick={() => editor.chain().focus().addRowAfter().run()}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-black/40 hover:text-black hover:bg-black/5 transition-all duration-300"
          title="Add row after"
        >
          <div className="relative">
            <ArrowDown className="w-3 h-3" />
            <Plus className="w-2 h-2 absolute -top-1 -right-1" />
          </div>
        </button>

        <div className="w-[1px] h-4 bg-black/[0.06] mx-1.5" />

        {/* 删除列 */}
        <button
          onClick={() => editor.chain().focus().deleteColumn().run()}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-rose-500/40 hover:text-rose-600 hover:bg-rose-500/5 transition-all duration-300"
          title="Delete column"
        >
          <div className="relative">
            <ArrowLeft className="w-3 h-3" />
            <Minus className="w-2 h-2 absolute -top-1 -right-1" />
          </div>
        </button>

        {/* 删除行 */}
        <button
          onClick={() => editor.chain().focus().deleteRow().run()}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-rose-500/40 hover:text-rose-600 hover:bg-rose-500/5 transition-all duration-300"
          title="Delete row"
        >
          <div className="relative">
            <ArrowUp className="w-3 h-3" />
            <Minus className="w-2 h-2 absolute -top-1 -right-1" />
          </div>
        </button>

        <div className="w-[1px] h-4 bg-black/[0.06] mx-1.5" />

        {/* 合并单元格 */}
        <button
          onClick={() => editor.chain().focus().mergeCells().run()}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-black/40 hover:text-black hover:bg-black/5 transition-all duration-300 disabled:opacity-10"
          title="Merge cells"
          disabled={!editor.can().mergeCells()}
        >
          <Merge className="w-4 h-4" />
        </button>

        {/* 拆分单元格 */}
        <button
          onClick={() => editor.chain().focus().splitCell().run()}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-black/40 hover:text-black hover:bg-black/5 transition-all duration-300 disabled:opacity-10"
          title="Split cell"
          disabled={!editor.can().splitCell()}
        >
          <Split className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-black/[0.06] mx-1.5" />

        {/* 删除表格 */}
        <button
          onClick={() => editor.chain().focus().deleteTable().run()}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-rose-500/60 hover:text-rose-600 hover:bg-rose-500/10 transition-all duration-300"
          title="Delete table"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </BubbleMenu>
  );
}

export default TableMenu;
