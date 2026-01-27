'use client'

import { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import {
  Plus,
  Minus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Merge,
  Split,
} from 'lucide-react'

interface TableMenuProps {
  editor: Editor
}

export function TableMenu({ editor }: TableMenuProps) {
  if (!editor) return null

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor }) => {
        return editor.isActive('table')
      }}
    >
      <div className="flex items-center gap-1 bg-background border rounded-lg shadow-lg p-1">
        {/* 添加列 */}
        <button
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          className="p-2 hover:bg-muted rounded flex items-center gap-1 text-xs"
          title="Add column after"
        >
          <ArrowRight className="w-3 h-3" />
          <Plus className="w-3 h-3" />
        </button>

        {/* 添加行 */}
        <button
          onClick={() => editor.chain().focus().addRowAfter().run()}
          className="p-2 hover:bg-muted rounded flex items-center gap-1 text-xs"
          title="Add row after"
        >
          <ArrowDown className="w-3 h-3" />
          <Plus className="w-3 h-3" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* 删除列 */}
        <button
          onClick={() => editor.chain().focus().deleteColumn().run()}
          className="p-2 hover:bg-muted rounded flex items-center gap-1 text-xs text-red-500"
          title="Delete column"
        >
          <ArrowLeft className="w-3 h-3" />
          <Minus className="w-3 h-3" />
        </button>

        {/* 删除行 */}
        <button
          onClick={() => editor.chain().focus().deleteRow().run()}
          className="p-2 hover:bg-muted rounded flex items-center gap-1 text-xs text-red-500"
          title="Delete row"
        >
          <ArrowUp className="w-3 h-3" />
          <Minus className="w-3 h-3" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* 合并单元格 */}
        <button
          onClick={() => editor.chain().focus().mergeCells().run()}
          className="p-2 hover:bg-muted rounded text-xs"
          title="Merge cells"
          disabled={!editor.can().mergeCells()}
        >
          <Merge className="w-4 h-4" />
        </button>

        {/* 拆分单元格 */}
        <button
          onClick={() => editor.chain().focus().splitCell().run()}
          className="p-2 hover:bg-muted rounded text-xs"
          title="Split cell"
          disabled={!editor.can().splitCell()}
        >
          <Split className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* 删除表格 */}
        <button
          onClick={() => editor.chain().focus().deleteTable().run()}
          className="p-2 hover:bg-muted rounded text-xs text-red-500"
          title="Delete table"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </BubbleMenu>
  )
}

export default TableMenu
