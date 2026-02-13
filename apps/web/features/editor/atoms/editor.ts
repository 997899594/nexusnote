/**
 * Editor State
 *
 * 编辑器相关的全局状态
 * 从 EditorContext 迁移而来
 */

import type { Editor } from "@tiptap/react";
import { atom } from "jotai";
import type { DocumentStructure, EditCommand } from "@/features/editor/core/document-parser";

// ============================================
// Atoms
// ============================================

/**
 * TipTap 编辑器实例
 */
export const editorAtom = atom<Editor | null>(null);

/**
 * 当前文档的 JSON 表示
 */
export const documentJSONAtom = atom<Record<string, unknown> | null>(null);

/**
 * 文档结构（解析后的块信息）
 */
export const documentStructureAtom = atom<DocumentStructure | null>(null);

/**
 * 当前选中的块 ID（用于高亮）
 */
export const selectedBlockIdAtom = atom<string | null>(null);

// ============================================
// Derived Atoms (只读计算属性)
// ============================================

/**
 * 文档纯文本内容
 */
export const documentContentAtom = atom((get) => {
  const editor = get(editorAtom);
  return editor?.getText() || "";
});

/**
 * 文档摘要
 */
export const documentSummaryAtom = atom((get) => {
  const structure = get(documentStructureAtom);
  if (!structure) return "";

  // 简单摘要：显示块数量和类型分布
  const blockCount = structure.blocks.length;
  const headingCount = structure.blocks.filter((b) => b.type === "heading").length;
  const codeBlockCount = structure.blocks.filter((b) => b.type === "codeBlock").length;

  return `${blockCount} blocks (${headingCount} headings, ${codeBlockCount} code)`;
});

// ============================================
// Write-only Atoms (操作方法)
// ============================================

/**
 * 设置编辑器实例
 */
export const setEditorAtom = atom(null, (_get, set, editor: Editor | null) => {
  set(editorAtom, editor);
});

/**
 * 高亮指定块
 */
export const highlightBlockAtom = atom(null, (get, set, blockId: string) => {
  const editor = get(editorAtom);
  const structure = get(documentStructureAtom);
  if (!editor || !structure) return;

  const block = structure.blocks.find((b) => b.id === blockId);
  if (block) {
    editor
      .chain()
      .focus()
      .setTextSelection({
        from: block.from + 1,
        to: block.to - 1,
      })
      .run();
  }
  set(selectedBlockIdAtom, blockId);
});

/**
 * 应用编辑命令
 */
export const applyEditAtom = atom(null, (get, _set, _command: EditCommand) => {
  const editor = get(editorAtom);
  const structure = get(documentStructureAtom);
  if (!editor || !structure) return false;

  // 导入 applyEditCommand 函数以避免循环依赖
  // 在实际使用时从 @/features/editor/core/document-parser 导入
  return false; // Placeholder
});

/**
 * 批量应用编辑命令
 */
export const applyEditsAtom = atom(null, (get, _set, commands: EditCommand[]) => {
  const editor = get(editorAtom);
  const structure = get(documentStructureAtom);
  if (!editor || !structure) {
    return { success: 0, failed: commands.length };
  }

  // 导入 applyEditCommands 函数
  // 在实际使用时从 @/features/editor/core/document-parser 导入
  return { success: 0, failed: commands.length }; // Placeholder
});
