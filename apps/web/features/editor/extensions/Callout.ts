/**
 * Callout Extension - 2026 Modern Implementation
 */

import { mergeAttributes, Node } from "@tiptap/core";

export type CalloutType = "info" | "warning" | "success" | "error";

const calloutStyles: Record<CalloutType, { bg: string; border: string; icon: string }> = {
  info: { bg: "#eff6ff", border: "#3b82f6", icon: "ℹ️" },
  warning: { bg: "#fffbeb", border: "#f59e0b", icon: "⚠️" },
  success: { bg: "#f0fdf4", border: "#22c55e", icon: "✅" },
  error: { bg: "#fef2f2", border: "#ef4444", icon: "❌" },
};

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
        (type = "info") =>
        ({ commands }: { commands: any }) =>
          commands.toggleNode(this.name, "paragraph", { type }),
      toggleCallout:
        (type = "info") =>
        ({ commands }: { commands: any }) =>
          commands.toggleNode(this.name, "paragraph", { type }),
      unsetCallout:
        () =>
        ({ commands }: { commands: any }) =>
          commands.lift(this.name, "paragraph"),
    } as any;
  },
});

export default Callout;
