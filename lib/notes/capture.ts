import type { Annotation } from "@/hooks/useAnnotations";
import { escapeHtml } from "@/lib/notes/content";

export interface CourseCaptureInput {
  courseTitle: string;
  sectionTitle: string;
  selectionText: string;
  noteContent?: string;
}

export interface LearnChatCaptureMessage {
  role: "user" | "assistant";
  text: string;
}

export interface LearnChatCaptureInput {
  courseTitle: string;
  chapterTitle?: string;
  messages: LearnChatCaptureMessage[];
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max).trim()}...` : value;
}

export function buildCapturedNoteTitle({
  sectionTitle,
  selectionText,
}: Pick<CourseCaptureInput, "sectionTitle" | "selectionText">) {
  const compactSelection = selectionText.replace(/\s+/g, " ").trim();
  const selectionPreview = truncate(compactSelection, 28);
  return truncate(`${sectionTitle} · ${selectionPreview}`, 80);
}

export function buildCapturedNotePlainText({
  courseTitle,
  sectionTitle,
  selectionText,
  noteContent,
}: CourseCaptureInput) {
  const blocks = [
    `课程：${courseTitle}`,
    `章节：${sectionTitle}`,
    "",
    "摘录：",
    selectionText.trim(),
  ];

  if (noteContent?.trim()) {
    blocks.push("", "我的想法：", noteContent.trim());
  }

  return blocks.join("\n");
}

export function buildCapturedNoteHtml({
  courseTitle,
  sectionTitle,
  selectionText,
  noteContent,
}: CourseCaptureInput) {
  const escapedSelection = escapeHtml(selectionText.trim()).replaceAll("\n", "<br />");
  const escapedNote = noteContent?.trim()
    ? escapeHtml(noteContent.trim()).replaceAll("\n", "<br />")
    : "";

  return [
    `<h2>${escapeHtml(courseTitle)}</h2>`,
    `<h3>${escapeHtml(sectionTitle)}</h3>`,
    `<blockquote><p>${escapedSelection}</p></blockquote>`,
    escapedNote ? `<p>${escapedNote}</p>` : "",
  ]
    .filter(Boolean)
    .join("");
}

export function serializeCaptureAnchor(anchor: Annotation["anchor"]) {
  return {
    textContent: anchor.textContent,
    startOffset: anchor.startOffset,
    endOffset: anchor.endOffset,
  };
}

export function buildLearnChatCapturedNoteTitle({
  chapterTitle,
  messages,
}: {
  chapterTitle?: string;
  messages: LearnChatCaptureMessage[];
}) {
  const firstQuestion = messages
    .find((item) => item.role === "user")
    ?.text.replace(/\s+/g, " ")
    .trim();
  const chapterLabel = chapterTitle?.trim() || "学习对话";

  if (!firstQuestion) {
    return truncate(`${chapterLabel} · 对话沉淀`, 80);
  }

  return truncate(`${chapterLabel} · ${truncate(firstQuestion, 24)}`, 80);
}

export function buildLearnChatCapturedPlainText({
  courseTitle,
  chapterTitle,
  messages,
}: LearnChatCaptureInput) {
  const blocks = [
    `课程：${courseTitle}`,
    chapterTitle?.trim() ? `章节：${chapterTitle.trim()}` : null,
    `时间：${new Date().toLocaleString("zh-CN")}`,
    "",
    "学习对话沉淀：",
    ...messages.map((item) => `${item.role === "user" ? "我" : "AI"}：${item.text.trim()}`),
  ].filter((item): item is string => Boolean(item));

  return blocks.join("\n");
}

export function buildLearnChatCapturedHtml({
  courseTitle,
  chapterTitle,
  messages,
}: LearnChatCaptureInput) {
  const conversationHtml = messages
    .map((item) => {
      const label = item.role === "user" ? "我" : "AI";
      const text = escapeHtml(item.text.trim()).replaceAll("\n", "<br />");
      return `<p><strong>${label}：</strong>${text}</p>`;
    })
    .join("");

  return [
    `<h2>${escapeHtml(courseTitle)}</h2>`,
    chapterTitle?.trim() ? `<h3>${escapeHtml(chapterTitle.trim())}</h3>` : "",
    conversationHtml,
  ]
    .filter(Boolean)
    .join("");
}
