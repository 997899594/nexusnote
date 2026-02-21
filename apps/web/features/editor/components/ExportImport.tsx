/**
 * Export/Import - 文档导出导入功能
 */

export type ExportFormat = "html" | "markdown" | "json" | "text" | "docx";

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  includeMetadata?: boolean;
}

const htmlToMarkdown = (html: string): string => {
  let markdown = html;
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n");
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, "##### $1\n\n");
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, "###### $1\n\n");
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`");
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, "```\n$1\n```\n");
  markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, "> $1\n");
  markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
  markdown = markdown.replace(/<ul[^>]*>|<\/ul>/gi, "");
  markdown = markdown.replace(/<ol[^>]*>|<\/ol>/gi, "");
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");
  markdown = markdown.replace(/<br\s*\/?>/gi, "\n");
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");
  markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, "![]($1)");
  markdown = markdown.replace(/<hr\s*\/?>/gi, "---\n");
  markdown = markdown.replace(/<[^>]+>/g, "");
  markdown = markdown.replace(/&nbsp;/g, " ");
  markdown = markdown.replace(/&amp;/g, "&");
  markdown = markdown.replace(/&lt;/g, "<");
  markdown = markdown.replace(/&gt;/g, ">");
  markdown = markdown.replace(/&quot;/g, '"');
  return markdown.trim();
};

export async function exportDocument(content: string, options: ExportOptions): Promise<void> {
  const { format, filename = "document" } = options;
  let output: string;
  let mimeType: string;
  let extension: string;

  switch (format) {
    case "html":
      output = content;
      mimeType = "text/html";
      extension = "html";
      break;
    case "markdown":
      output = htmlToMarkdown(content);
      mimeType = "text/markdown";
      extension = "md";
      break;
    case "json":
      output = JSON.stringify({ content, exportedAt: new Date().toISOString() }, null, 2);
      mimeType = "application/json";
      extension = "json";
      break;
    case "text":
      output = content.replace(/<[^>]+>/g, "");
      mimeType = "text/plain";
      extension = "txt";
      break;
    default:
      output = content;
      mimeType = "text/html";
      extension = "html";
  }

  const blob = new Blob([output], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function importDocument(file: File): Promise<string> {
  const text = await file.text();

  if (file.name.endsWith(".html") || file.name.endsWith(".htm")) {
    return text;
  }

  if (file.name.endsWith(".md") || file.name.endsWith(".markdown")) {
    return markdownToHtml(text);
  }

  if (file.name.endsWith(".json")) {
    try {
      const json = JSON.parse(text);
      return json.content || json.html || text;
    } catch {
      return text;
    }
  }

  return `<p>${text}</p>`;
}

const markdownToHtml = (markdown: string): string => {
  let html = markdown;
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.replace(/```\w*\n?/g, "").trim();
    return `<pre><code>${code}</code></pre>`;
  });
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/!\[.*?\]\((.+?)\)/g, '<img src="$1" />');
  html = html.replace(/^---$/gm, "<hr />");
  html = html.replace(/\n\n/g, "</p><p>");
  html = `<p>${html}</p>`;
  return html;
};

export function ExportButton({ content, filename }: { content: string; filename?: string }) {
  const [showMenu, setShowMenu] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    await exportDocument(content, { format, filename });
    setShowMenu(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        style={{
          padding: "8px 16px",
          border: "1px solid #ddd",
          borderRadius: 6,
          background: "white",
          cursor: "pointer",
        }}
      >
        导出
      </button>
      {showMenu && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            minWidth: 150,
            zIndex: 100,
          }}
        >
          {(["html", "markdown", "json", "text"] as ExportFormat[]).map((format) => (
            <button
              key={format}
              onClick={() => handleExport(format)}
              style={{
                display: "block",
                width: "100%",
                padding: "10px 16px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                borderBottom: format !== "text" ? "1px solid #eee" : "none",
              }}
            >
              {format.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";

export function ImportButton({ onImport }: { onImport: (content: string) => void }) {
  const [loading, setLoading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const content = await importDocument(file);
      onImport(content);
    } catch (error) {
      console.error("Import failed:", error);
    }
    setLoading(false);
  };

  return (
    <label
      style={{
        padding: "8px 16px",
        border: "1px solid #ddd",
        borderRadius: 6,
        background: "white",
        cursor: "pointer",
      }}
    >
      {loading ? "导入中..." : "导入"}
      <input
        type="file"
        accept=".html,.md,.markdown,.json,.txt"
        onChange={handleFile}
        style={{ display: "none" }}
      />
    </label>
  );
}
