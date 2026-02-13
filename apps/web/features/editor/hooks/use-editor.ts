/**
 * Editor Hooks
 *
 * 基于 Jotai 的编辑器状态管理
 * 替代 EditorContext
 */

"use client";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect } from "react";
import type { DocumentBlock, DocumentStructure, EditCommand } from "@/features/editor/core/document-parser";
import {
  documentContentAtom,
  documentJSONAtom,
  documentStructureAtom,
  documentSummaryAtom,
  editorAtom,
  highlightBlockAtom,
  selectedBlockIdAtom,
} from "../atoms/editor";

// ============================================
// Main Hook
// ============================================

/**
 * 编辑器主 Hook
 *
 * 替代 EditorContext 的 useEditorContext
 */
export function useEditor() {
  const [editor, setEditor] = useAtom(editorAtom);
  const [_documentJSON] = useAtom(documentJSONAtom);
  const [_documentStructure] = useAtom(documentStructureAtom);
  const documentContent = useAtomValue(documentContentAtom);
  const documentSummary = useAtomValue(documentSummaryAtom);
  const [selectedBlockId, setSelectedBlockId] = useAtom(selectedBlockIdAtom);

  /**
   * 获取文档纯文本内容
   */
  const getDocumentContent = useCallback(() => {
    return editor?.getText() || "";
  }, [editor]);

  /**
   * 获取文档 JSON
   */
  const getDocumentJSON = useCallback(() => {
    return editor?.getJSON() || null;
  }, [editor]);

  /**
   * 获取文档结构
   */
  const getDocumentStructure = useCallback((): DocumentStructure | null => {
    if (!editor) return null;

    // 动态导入以避免循环依赖
    import("@/features/editor/core/document-parser").then(({ parseDocument }) => {
      return parseDocument(editor);
    });

    // 内联实现以避免异步问题
    const doc = editor.state.doc;
    const blocks: DocumentBlock[] = [];

    doc.descendants((node, pos) => {
      if (
        node.type.name === "paragraph" ||
        node.type.name === "heading" ||
        node.type.name === "codeBlock"
      ) {
        blocks.push({
          id: `block-${pos}`,
          type: node.type.name,
          from: pos,
          to: pos + node.nodeSize,
          content: node.textContent,
          index: blocks.length,
          globalIndex: pos,
        });
      }
    });

    const headings = blocks.filter((b) => b.type === "heading");
    const paragraphs = blocks.filter((b) => b.type === "paragraph");

    return {
      blocks,
      totalBlocks: blocks.length,
      headings,
      paragraphs,
    };
  }, [editor]);

  /**
   * 获取文档摘要
   */
  const getDocumentSummary = useCallback((): string => {
    if (!editor) return "";

    const structure = getDocumentStructure();
    if (!structure) return "";

    const blockCount = structure.blocks.length;
    const headingCount = structure.blocks.filter((b) => b.type === "heading").length;
    const codeBlockCount = structure.blocks.filter((b) => b.type === "codeBlock").length;

    return `${blockCount} blocks (${headingCount} headings, ${codeBlockCount} code)`;
  }, [editor, getDocumentStructure]);

  /**
   * 解析块引用
   */
  const resolveBlockRef = useCallback(
    (reference: string): DocumentBlock | null => {
      if (!editor) return null;

      const structure = getDocumentStructure();
      if (!structure) return null;

      // 简化实现
      return structure.blocks.find((b) => b.id === reference) || null;
    },
    [editor, getDocumentStructure],
  );

  /**
   * 应用编辑命令
   * TODO: 需要改为 async 或使用同步实现
   */
  const applyEdit = useCallback(
    (_command: EditCommand): boolean => {
      if (!editor) return false;

      // 简化实现：暂时返回 false
      // 完整实现需要动态导入 document-parser
      return false;
    },
    [editor],
  );

  /**
   * 批量应用编辑命令
   * TODO: 需要改为 async 或使用同步实现
   */
  const applyEdits = useCallback(
    (commands: EditCommand[]): { success: number; failed: number } => {
      if (!editor) return { success: 0, failed: commands.length };

      // 简化实现：暂时返回默认值
      return { success: 0, failed: commands.length };
    },
    [editor],
  );

  /**
   * 高亮指定块
   */
  const highlightBlock = useCallback(
    (blockId: string) => {
      setSelectedBlockId(blockId);

      if (!editor) return;

      // 获取结构并查找块
      const doc = editor.state.doc;
      let targetBlock: { from: number; to: number } | null = null;

      doc.descendants((node, pos) => {
        const currentId = `block-${pos}`;
        if (currentId === blockId && !targetBlock) {
          targetBlock = {
            from: pos + 1,
            to: pos + node.nodeSize - 1,
          };
        }
      });

      if (targetBlock) {
        editor.chain().focus().setTextSelection(targetBlock).run();
      }
    },
    [editor, setSelectedBlockId],
  );

  // 同步 documentJSON 到 atom
  useEffect(() => {
    if (editor) {
      setEditor(editor);
      // 定期更新 documentJSON
      const updateJSON = () => {
        // documentJSON 会在需要时从 editor 获取
      };
      editor.on("update", updateJSON);
      return () => {
        editor.off("update", updateJSON);
      };
    }
  }, [editor, setEditor]);

  return {
    editor,
    setEditor,
    getDocumentContent,
    getDocumentJSON,
    getDocumentStructure,
    getDocumentSummary,
    resolveBlockRef,
    applyEdit,
    applyEdits,
    highlightBlock,
    // 只读状态
    documentContent,
    documentSummary,
    selectedBlockId,
  };
}

/**
 * 可选版本的 Hook - 不抛出错误
 */
export function useEditorOptional() {
  try {
    // biome-ignore lint/correctness/useHookAtTopLevel: hook is always called, try/catch is for context check
    return useEditor();
  } catch {
    return {
      editor: null,
      setEditor: () => {},
      getDocumentContent: () => "",
      getDocumentJSON: () => null,
      getDocumentStructure: () => null,
      getDocumentSummary: () => "",
      resolveBlockRef: () => null,
      applyEdit: () => false,
      applyEdits: () => ({ success: 0, failed: 0 }),
      highlightBlock: () => {},
      documentContent: "",
      documentSummary: "",
      selectedBlockId: null,
    };
  }
}

// ============================================
// Individual Hooks (如果只需要部分状态)
// ============================================

/**
 * 仅获取编辑器实例
 */
export function useEditorInstance() {
  return useAtom(editorAtom);
}

/**
 * 仅获取文档内容
 */
export function useDocumentContent() {
  return useAtomValue(documentContentAtom);
}

/**
 * 仅获取文档结构
 */
export function useDocumentStructure() {
  return useAtom(documentStructureAtom);
}

/**
 * 仅获取高亮块操作
 */
export function useBlockHighlight() {
  const highlight = useSetAtom(highlightBlockAtom);
  const selectedBlockId = useAtomValue(selectedBlockIdAtom);

  return {
    highlightBlock: highlight,
    selectedBlockId,
  };
}
