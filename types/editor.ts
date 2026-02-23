/**
 * Editor Types - Tiptap Editor 类型定义
 *
 * 严格的类型定义，无 any
 */

import type { Editor } from "@tiptap/react";

/**
 * Slash Command 类型
 */
export interface SlashCommand {
  id: string;
  label: string;
  icon: string;
  command: (editor: Editor) => void;
}

/**
 * Tiptap Editor with extensions
 */
export type TiptapEditor = Editor;
