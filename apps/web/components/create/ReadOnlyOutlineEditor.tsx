"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Image } from "@tiptap/extension-image";
import { Dropcursor } from "@tiptap/extension-dropcursor";
import { Gapcursor } from "@tiptap/extension-gapcursor";
import { useEffect } from "react";
import { Callout } from "@/components/editor/extensions/callout";
import { Collapsible } from "@/components/editor/extensions/collapsible";
import type { OutlineData } from "@/lib/ai/profile/course-profile";

interface ReadOnlyOutlineEditorProps {
  outline: OutlineData;
  isGenerating?: boolean;
}

// Convert outline JSON to HTML for Tiptap
function outlineToHtml(outline: OutlineData): string {
  let html = `<h1>${outline.title}</h1>`;

  if (outline.description) {
    html += `<p>${outline.description}</p>`;
  }

  html += `<p><strong>难度:</strong> ${getDifficultyLabel(outline.difficulty)} | <strong>预估时长:</strong> ${outline.estimatedMinutes} 分钟</p>`;

  if (outline.reason) {
    html += `<blockquote><p><strong>课程设计理由:</strong> ${outline.reason}</p></blockquote>`;
  }

  html += "<hr>";

  if (outline.modules && outline.modules.length > 0) {
    for (const module of outline.modules) {
      html += `<h2>${module.title}</h2>`;

      for (const chapter of module.chapters) {
        html += `<h3>${chapter.title}</h3>`;
        if (chapter.contentSnippet) {
          html += `<p>${chapter.contentSnippet}</p>`;
        }
      }
    }
  }

  return html;
}

function getDifficultyLabel(
  difficulty: "beginner" | "intermediate" | "advanced"
): string {
  const labels = {
    beginner: "初级",
    intermediate: "中级",
    advanced: "高级",
  };
  return labels[difficulty];
}

export function ReadOnlyOutlineEditor({
  outline,
  isGenerating = false,
}: ReadOnlyOutlineEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: { languageClassPrefix: "language-" },
      }),
      Placeholder.configure({
        placeholder: "课程大纲加载中...",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Image,
      Dropcursor,
      Gapcursor,
      Callout,
      Collapsible,
    ],
    content: outlineToHtml(outline),
    editable: false,
    // 禁用所有用户交互
    immediatelyRender: false,
  });

  // 当 outline 更新时刷新编辑器内容
  useEffect(() => {
    if (editor && !isGenerating) {
      editor.commands.setContent(outlineToHtml(outline));
    }
  }, [outline, editor, isGenerating]);

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">课程大纲</h2>
        <p className="text-sm text-gray-600 mt-1">
          {outline.estimatedMinutes} 分钟 • {getDifficultyLabel(outline.difficulty)}难度
        </p>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none px-6 py-4 focus:outline-none"
        />
      </div>

      {/* Footer - Loading State */}
      {isGenerating && (
        <div className="flex-shrink-0 px-6 py-3 border-t border-gray-200 bg-blue-50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-blue-700">大纲生成中...</span>
          </div>
        </div>
      )}
    </div>
  );
}
