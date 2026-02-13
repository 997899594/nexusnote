import { marked } from "marked";

// ============================================
// Markdown 工具函数
// 用于将 AI 生成的 Markdown 转换为编辑器可用格式
// ============================================

// 配置 marked
marked.setOptions({
  breaks: true, // 换行转 <br>
  gfm: true, // GitHub Flavored Markdown
});

/**
 * 将 Markdown 转换为 HTML
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return "";

  // marked.parse 可能返回 Promise，使用 parseInline 或同步方式
  const html = marked.parse(markdown, { async: false }) as string;
  return html;
}

/**
 * 检测文本是否包含 Markdown 格式
 */
export function containsMarkdown(text: string): boolean {
  const markdownPatterns = [
    /^#{1,6}\s/m, // 标题 # ## ###
    /\*\*[^*]+\*\*/, // 粗体 **text**
    /\*[^*]+\*/, // 斜体 *text*
    /`[^`]+`/, // 行内代码 `code`
    /```[\s\S]*?```/, // 代码块
    /^\s*[-*+]\s/m, // 无序列表
    /^\s*\d+\.\s/m, // 有序列表
    /^\s*>\s/m, // 引用
    /\[.+\]\(.+\)/, // 链接 [text](url)
    /!\[.*\]\(.+\)/, // 图片 ![alt](url)
    /^\s*\|.+\|/m, // 表格
    /^---+$/m, // 分隔线
  ];

  return markdownPatterns.some((pattern) => pattern.test(text));
}

/**
 * 智能转换：如果是 Markdown 则转 HTML，否则返回原文
 */
export function smartConvert(text: string): { html: string; isMarkdown: boolean } {
  const isMarkdown = containsMarkdown(text);

  if (isMarkdown) {
    return {
      html: markdownToHtml(text),
      isMarkdown: true,
    };
  }

  // 非 Markdown，转换换行为 <br> 或 <p>
  const paragraphs = text.split(/\n\n+/);
  if (paragraphs.length > 1) {
    const html = paragraphs.map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
    return { html, isMarkdown: false };
  }

  return {
    html: `<p>${text.replace(/\n/g, "<br>")}</p>`,
    isMarkdown: false,
  };
}

/**
 * 清理 HTML，移除可能的危险标签
 */
export function sanitizeHtml(html: string): string {
  // 移除 script 标签
  let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  // 移除 on* 事件属性
  clean = clean.replace(/\s+on\w+="[^"]*"/gi, "");
  clean = clean.replace(/\s+on\w+='[^']*'/gi, "");
  return clean;
}

export default {
  markdownToHtml,
  containsMarkdown,
  smartConvert,
  sanitizeHtml,
};
