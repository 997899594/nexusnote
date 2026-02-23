/**
 * Callout Extension - 2026 Modern Implementation
 *
 * 架构说明：
 * Tiptap 的 addCommands 返回类型必须是 Partial<RawCommands>，但 RawCommands 是基于内置 Commands 生成的。
 * 正确的做法是：扩展 Commands 接口，而不是直接在 addCommands 中返回自定义命令。
 */

import { mergeAttributes, Node } from "@tiptap/core";

export type CalloutType = "info" | "warning" | "success" | "error";

const calloutStyles: Record<CalloutType, { bg: string; border: string; icon: string }> = {
  info: { bg: "#eff6ff", border: "#3b82f6", icon: "ℹ️" },
  warning: { bg: "#fffbeb", border: "#f59e0b", icon: "⚠️" },
  success: { bg: "#f0fdf4", border: "#22c55e", icon: "✅" },
  error: { bg: "#fef2f2", border: "#ef4444", icon: "❌" },
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    setCallout: {
      setCallout: (type?: CalloutType) => ReturnType;
    };
    toggleCallout: {
      toggleCallout: (type?: CalloutType) => ReturnType;
    };
    unsetCallout: {
      unsetCallout: () => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: "callout",

  group: "block",

  content: "block+",

  defining: true,

  addAttributes() {
    return {
      type: {
        default: "info",
        parseHTML: (element) => element.getAttribute("data-callout-type") || "info",
        renderHTML: (attributes) => ({ "data-callout-type": attributes.type }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout-type]" }];
  },

  renderHTML({ node }) {
    const type = node.attrs.type as CalloutType;
    const style = calloutStyles[type];
    return [
      "div",
      mergeAttributes({
        "data-callout-type": type,
        style: `padding: 16px; margin: 8px 0; background: ${style.bg}; border-left: 4px solid ${style.border}; border-radius: 8px; display: flex; gap: 12px;`,
      }),
      ["span", { style: "font-size: 20px; line-height: 1;" }, style.icon],
      ["div", { style: "flex: 1;" }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (type: CalloutType = "info") =>
        ({ commands }) => {
          return commands.toggleNode(this.name, "paragraph", { type });
        },
      toggleCallout:
        (type: CalloutType = "info") =>
        ({ commands }) => {
          return commands.toggleNode(this.name, "paragraph", { type });
        },
      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.lift("paragraph");
        },
    };
  },
});

export default Callout;
