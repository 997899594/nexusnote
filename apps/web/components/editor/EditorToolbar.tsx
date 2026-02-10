'use client'

import { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Shield,
  ShieldOff,
  MoreHorizontal,
  Link as LinkIcon,
  Image as ImageIcon,
  Minus,
  Undo,
  Redo,
} from "lucide-react";
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface EditorToolbarProps {
  editor: Editor | null;
  isVault?: boolean;
  onToggleVault?: () => void;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  children,
  title,
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'w-8 h-8 flex items-center justify-center rounded-xl',
        'transition-all duration-200',
        isActive
          ? 'bg-primary text-primary-foreground shadow-lg'
          : 'text-foreground/60 hover:bg-foreground/5 hover:text-foreground active:bg-foreground/10',
        disabled && 'opacity-30 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-border/10 mx-1" />;
}

interface ToolbarItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  action: () => void;
  group?: 'text' | 'list' | 'heading' | 'insert';
}

const toolbarButtons: ToolbarItem[] = [
  { icon: Bold, label: '加粗', action: () => {}, group: 'text' },
  { icon: Italic, label: '斜体', action: () => {}, group: 'text' },
  { icon: Strikethrough, label: '删除线', action: () => {}, group: 'text' },
  { icon: Code, label: '代码', action: () => {}, group: 'text' },
  { icon: List, label: '无序列表', action: () => {}, group: 'list' },
  { icon: ListOrdered, label: '有序列表', action: () => {}, group: 'list' },
  { icon: Quote, label: '引用', action: () => {}, group: 'list' },
  { icon: Heading1, label: '标题 1', action: () => {}, group: 'heading' },
  { icon: Heading2, label: '标题 2', action: () => {}, group: 'heading' },
  { icon: Heading3, label: '标题 3', action: () => {}, group: 'heading' },
  { icon: LinkIcon, label: '链接', action: () => {}, group: 'insert' },
  { icon: ImageIcon, label: '图片', action: () => {}, group: 'insert' },
  { icon: Minus, label: '分割线', action: () => {}, group: 'insert' },
]

export function EditorToolbar({
  editor,
  isVault,
  onToggleVault,
}: EditorToolbarProps) {
  const [expanded, setExpanded] = useState(false)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  if (!editor) return null;

  const executeAction = (action: () => void) => {
    action?.()
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-lg border-t border-border/5 pb-safe-bottom md:hidden">
        <div className="flex items-center gap-1 overflow-x-auto px-2 py-2 scrollbar-hide">
          {toolbarButtons.filter(b => b.group === 'text').slice(0, 4).map((button, idx) => (
            <ToolbarButton
              key={button.label + idx}
              onClick={() => executeAction(button.action)}
              title={button.label}
            >
              <button.icon className="w-4 h-4" />
            </ToolbarButton>
          ))}

          <Divider />

          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center justify-center p-2 rounded-xl hover:bg-foreground/5 active:bg-foreground/10 transition-colors touch-safe shrink-0"
          >
            <MoreHorizontal className="w-5 h-5 text-foreground/60" />
          </button>
        </div>

        {expanded && (
          <div className="px-2 pb-2 pt-1 border-t border-border/5 animate-slide-up">
            <div className="flex gap-2 mb-2 overflow-x-auto scrollbar-hide">
              {['text', 'list', 'heading', 'insert'].map((group) => (
                <button
                  key={group}
                  onClick={() => setActiveGroup(activeGroup === group ? null : group)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                    activeGroup === group
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground/60 hover:bg-foreground/5'
                  )}
                >
                  {group === 'text' && '文本'}
                  {group === 'list' && '列表'}
                  {group === 'heading' && '标题'}
                  {group === 'insert' && '插入'}
                </button>
              ))}
            </div>

            {activeGroup && (
              <div className="grid grid-cols-5 gap-1">
                {toolbarButtons
                  .filter(b => b.group === activeGroup)
                  .map((button, idx) => (
                    <ToolbarButton
                      key={button.label + idx}
                      onClick={() => executeAction(button.action)}
                      title={button.label}
                    >
                      <button.icon className="w-4 h-4" />
                    </ToolbarButton>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sticky top-0 z-10 hidden md:flex items-center gap-1 px-4 py-3 border-b border-border/5 bg-surface animate-scale-in">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="撤销 (Cmd+Z)"
        >
          <Undo className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="重做 (Cmd+Shift+Z)"
        >
          <Redo className="w-3.5 h-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive("heading", { level: 1 })}
          title="一级标题"
        >
          <Heading1 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          title="二级标题"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          title="三级标题"
        >
          <Heading3 className="w-3.5 h-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="加粗 (Cmd+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="斜体 (Cmd+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          title="删除线"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive("code")}
          title="行内代码"
        >
          <Code className="w-3.5 h-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="无序列表"
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="有序列表"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          title="引用"
        >
          <Quote className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="分割线"
        >
          <Minus className="w-3.5 h-3.5" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => onToggleVault?.()}
          isActive={isVault}
          title={isVault ? "关闭加密模式" : "开启加密模式"}
        >
          {isVault ? (
            <Shield className="w-3.5 h-3.5 text-amber-500" />
          ) : (
            <ShieldOff className="w-3.5 h-3.5" />
          )}
        </ToolbarButton>
      </div>
    </>
  );
}
