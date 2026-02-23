/**
 * Editor - 2026 Modern Tiptap Editor with All Extensions
 */

"use client";

import Details from "@tiptap/extension-details";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import type { Editor as TiptapEditorType } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";
import type { SlashCommand } from "@/types/editor";
import { Callout } from "./Callout";

interface EditorProps {
  content?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
  editable?: boolean;
}

const SlashCommands: SlashCommand[] = [
  {
    id: "heading1",
    label: "标题 1",
    icon: "H1",
    command: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: "heading2",
    label: "标题 2",
    icon: "H2",
    command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: "heading3",
    label: "标题 3",
    icon: "H3",
    command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: "bullet",
    label: "无序列表",
    icon: "•",
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: "ordered",
    label: "有序列表",
    icon: "1.",
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "task",
    label: "任务列表",
    icon: "☑",
    command: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    id: "code",
    label: "代码块",
    icon: "</>",
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: "quote",
    label: "引用",
    icon: '"',
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "divider",
    label: "分割线",
    icon: "—",
    command: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    id: "highlight",
    label: "高亮",
    icon: "🖍",
    command: (editor) => editor.chain().focus().toggleHighlight().run(),
  },
  {
    id: "link",
    label: "链接",
    icon: "🔗",
    command: (editor) => editor.chain().focus().setLink({ href: "https://" }).run(),
  },
  {
    id: "underline",
    label: "下划线",
    icon: "U",
    command: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
];

interface SlashMenuProps {
  editor: TiptapEditorType;
  onClose: () => void;
}

function SlashMenu({ editor, onClose }: SlashMenuProps) {
  const [search, setSearch] = useState("");
  const filtered = SlashCommands.filter((c) =>
    c.label.toLowerCase().includes(search.toLowerCase()),
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="absolute left-0 z-50 p-2 bg-white border rounded-lg shadow-card min-w-[200px] top-full">
      <input
        placeholder="搜索命令..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && filtered[0]) {
            filtered[0].command(editor);
            onClose();
          }
        }}
        className="w-full px-3 py-2 mb-2 border border-border rounded-md"
      />
      {filtered.map((cmd) => (
        <button
          type="button"
          key={cmd.id}
          onClick={() => {
            cmd.command(editor);
            onClose();
          }}
          className="flex items-center gap-3 w-full px-3 py-2 text-left border-none bg-transparent cursor-pointer hover:bg-hover rounded-md"
        >
          <span className="w-6 text-center font-bold">{cmd.icon}</span>
          <span>{cmd.label}</span>
        </button>
      ))}
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
}

function ToolbarButton({ onClick, active, children, disabled }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1.5 rounded-md border-none cursor-pointer ${
        active ? "bg-hover" : "bg-transparent"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}

export function Editor({
  content = "",
  placeholder = "输入 / 查看命令...",
  onChange,
  editable = true,
}: EditorProps) {
  const [showSlash, setShowSlash] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder, emptyEditorClass: "is-editor-empty" }),
      Highlight,
      Image,
      Link.configure({ openOnClick: false }),
      TaskList,
      TextStyle,
      Underline,
      Details,
      Callout,
    ],
    content,
    editable,
    onUpdate: ({ editor: ed }) => {
      const text = ed.getText();
      if (text.endsWith("/")) setShowSlash(true);
      else if (showSlash) setShowSlash(false);
      onChange?.(ed.getHTML());
    },
    editorProps: { attributes: { class: "prose focus:outline-none min-h-[200px] p-4" } },
  });

  if (!editor) return null;

  const addImage = () => {
    const url = window.prompt("输入图片 URL");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div className="relative border border-border rounded-lg overflow-hidden">
      {editable && (
        <div className="flex flex-wrap gap-1 p-2 border-b border-border-subtle">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
          >
            <b>B</b>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
          >
            <i>I</i>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
          >
            <u>U</u>
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            active={editor.isActive("highlight")}
          >
            🖍
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
          >
            <s>S</s>
          </ToolbarButton>
          <span className="w-px bg-border mx-2" />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive("heading", { level: 1 })}
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
          >
            H3
          </ToolbarButton>
          <span className="w-px bg-border mx-2" />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
          >
            •
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
          >
            1.
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            active={editor.isActive("taskList")}
          >
            ☑
          </ToolbarButton>
          <span className="w-px bg-border mx-2" />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive("codeBlock")}
          >
            &lt;/&gt;
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
          >
            "
          </ToolbarButton>
          <ToolbarButton onClick={addImage}>🖼</ToolbarButton>
          <span className="w-px bg-border mx-2" />
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            ↩
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            ↪
          </ToolbarButton>
        </div>
      )}
      <div className="relative">
        <EditorContent editor={editor} />
        {showSlash && <SlashMenu editor={editor} onClose={() => setShowSlash(false)} />}
      </div>
    </div>
  );
}

export default Editor;
