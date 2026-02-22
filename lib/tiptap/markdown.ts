/**
 * Tiptap Markdown Server-Side Conversion
 *
 * 使用 MarkdownManager 进行无 DOM 的服务端 Markdown ↔ JSON 转换
 * 适用于 Server Components 预处理内容
 */

import { MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";

// 配置扩展
const extensions = [
  StarterKit,
  Markdown,
  // 可添加更多扩展，如 Table, TaskList 等
];

// 创建单例 MarkdownManager
export const markdownManager = new MarkdownManager({ extensions });

/**
 * 将 Tiptap JSON 转换为 Markdown 字符串
 *
 * @param json - Tiptap JSON 对象
 * @returns Markdown 字符串
 *
 * @example
 * ```ts
 * const json = editor.getJSON();
 * const md = jsonToMarkdown(json);
 * ```
 */
export function jsonToMarkdown(json: unknown): string {
  try {
    return markdownManager.serialize(json);
  } catch (error) {
    console.error("[jsonToMarkdown] Conversion error:", error);
    // 返回空字符串作为降级
    return "";
  }
}

/**
 * 将 Markdown 字符串转换为 Tiptap JSON
 *
 * @param markdown - Markdown 字符串
 * @returns Tiptap JSON 对象
 *
 * @example
 * ```ts
 * const json = markdownToJson("# Hello\n\nWorld");
 * editor.setContent(json);
 * ```
 */
export function markdownToJson(markdown: string): unknown {
  try {
    return markdownManager.parse(markdown);
  } catch (error) {
    console.error("[markdownToJson] Conversion error:", error);
    // 返回空文档作为降级
    return {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: markdown }],
        },
      ],
    };
  }
}

/**
 * 类型安全的 Tiptap 文档结构
 */
export interface TiptapDocument {
  type: "doc";
  content: TiptapNode[];
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
}

export interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}
