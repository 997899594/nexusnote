/**
 * AI Editor Tools - 2026 Modern Implementation
 * 用 AI SDK 实现 Tiptap 付费插件的核心功能
 */

export type EditorInstance = {
  getHTML: () => string;
  getJSON: () => unknown;
  getText: () => string;
  chain: () => any;
  can: () => { undo: () => boolean; redo: () => boolean };
  commands: {
    insertContent: (content: string) => boolean;
    setContent: (content: string) => boolean;
  };
};

export interface TiptapTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

export const createTiptapTools = (editor: EditorInstance): Record<string, TiptapTool> => ({
  readDocument: {
    name: "readDocument",
    description: "读取当前编辑器中的完整文档内容",
    parameters: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["html", "json", "text"], default: "html" },
        selectionOnly: { type: "boolean", default: false },
      },
    },
    execute: async ({ format, selectionOnly }) => {
      if (selectionOnly) {
        const selection = window.getSelection()?.toString() || "";
        return { content: selection, format: "text" };
      }
      const fmt = (format as string) || "html";
      if (fmt === "html") return { content: editor.getHTML(), format: "html" };
      if (fmt === "json") return { content: editor.getJSON(), format: "json" };
      return { content: editor.getText(), format: "text" };
    },
  },

  insertContent: {
    name: "insertContent",
    description: "在当前位置插入新内容",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string" },
        asHtml: { type: "boolean", default: true },
      },
      required: ["content"],
    },
    execute: async ({ content, asHtml }) => {
      const html = asHtml ? content : `<p>${content}</p>`;
      editor.chain().focus().insertContent(html).run();
      return { success: true, content };
    },
  },

  replaceSelection: {
    name: "replaceSelection",
    description: "替换当前选中的内容",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string" },
        asHtml: { type: "boolean", default: true },
      },
      required: ["content"],
    },
    execute: async ({ content, asHtml }) => {
      const html = asHtml ? content : `<p>${content}</p>`;
      editor.chain().focus().insertContent(html).run();
      return { success: true, content };
    },
  },

  setDocument: {
    name: "setDocument",
    description: "用新内容替换整个文档",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string" },
        asHtml: { type: "boolean", default: true },
      },
      required: ["content"],
    },
    execute: async ({ content, asHtml }) => {
      const html = asHtml ? String(content) : `<p>${content}</p>`;
      editor.commands.setContent(html);
      return { success: true, content };
    },
  },

  formatText: {
    name: "formatText",
    description: "对选中文本应用格式",
    parameters: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["bold", "italic", "underline", "strike", "highlight", "code"],
        },
        action: { type: "string", enum: ["toggle", "set", "unset"], default: "toggle" },
      },
      required: ["format"],
    },
    execute: async ({ format, action }) => {
      const chain = editor.chain().focus();
      switch (format) {
        case "bold":
          chain.toggleBold?.().run();
          break;
        case "italic":
          chain.toggleItalic?.().run();
          break;
        case "underline":
          chain.toggleUnderline?.().run();
          break;
        case "strike":
          chain.toggleStrike?.().run();
          break;
        case "highlight":
          chain.toggleHighlight?.().run();
          break;
        case "code":
          chain.toggleCode?.().run();
          break;
      }
      return { success: true, format, action };
    },
  },

  addHeading: {
    name: "addHeading",
    description: "将选中的段落转换为标题",
    parameters: {
      type: "object",
      properties: {
        level: { type: "number", minimum: 1, maximum: 6, default: 1 },
      },
    },
    execute: async ({ level }) => {
      editor.chain().focus().toggleHeading?.({ level }).run();
      return { success: true, level };
    },
  },

  addList: {
    name: "addList",
    description: "添加无序或有序列表",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["bullet", "ordered", "task"] },
      },
      required: ["type"],
    },
    execute: async ({ type }) => {
      const chain = editor.chain().focus();
      type === "bullet"
        ? chain.toggleBulletList?.().run()
        : type === "ordered"
          ? chain.toggleOrderedList?.().run()
          : chain.toggleTaskList?.().run();
      return { success: true, type };
    },
  },

  addBlockquote: {
    name: "addBlockquote",
    description: "将选中的内容转换为引用块",
    parameters: { type: "object", properties: {} },
    execute: async () => {
      editor.chain().focus().toggleBlockquote?.().run();
      return { success: true };
    },
  },

  addCodeBlock: {
    name: "addCodeBlock",
    description: "将选中的内容转换为代码块",
    parameters: {
      type: "object",
      properties: {
        language: { type: "string" },
      },
    },
    execute: async ({ language }) => {
      editor.chain().focus().toggleCodeBlock?.().run();
      return { success: true, language };
    },
  },

  undo: {
    name: "undo",
    description: "撤销上一步操作",
    parameters: { type: "object", properties: {} },
    execute: async () => {
      editor.chain().focus().undo?.().run();
      return { success: true };
    },
  },

  redo: {
    name: "redo",
    description: "重做上一步操作",
    parameters: { type: "object", properties: {} },
    execute: async () => {
      editor.chain().focus().redo?.().run();
      return { success: true };
    },
  },
});

export interface Suggestion {
  id: string;
  type: "insert" | "replace" | "delete" | "format";
  content?: string;
  format?: string;
  position?: { from: number; to: number };
  explanation: string;
  accepted: boolean;
  rejected: boolean;
  createdAt: Date;
}

export const createProofreadTools = (editor: EditorInstance): Record<string, TiptapTool> => ({
  proofread: {
    name: "proofread",
    description: "校对文本，检查语法和拼写错误",
    parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
    execute: async ({ text }) => ({ text, needsProofread: true }),
  },

  improveStyle: {
    name: "improveStyle",
    description: "改进文本的写作风格",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string" },
        style: {
          type: "string",
          enum: ["professional", "casual", "academic", "creative"],
          default: "professional",
        },
      },
      required: ["text"],
    },
    execute: async ({ text, style }) => ({ text, style, needsImprove: true }),
  },

  simplify: {
    name: "simplify",
    description: "简化复杂文本",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string" },
        level: { type: "string", enum: ["simple", "moderate"], default: "simple" },
      },
      required: ["text"],
    },
    execute: async ({ text, level }) => ({ text, level, needsSimplify: true }),
  },

  expand: {
    name: "expand",
    description: "扩展和丰富文本内容",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string" },
        factor: { type: "number", minimum: 1.5, maximum: 3, default: 2 },
      },
      required: ["text"],
    },
    execute: async ({ text, factor }) => ({ text, factor, needsExpand: true }),
  },
});
