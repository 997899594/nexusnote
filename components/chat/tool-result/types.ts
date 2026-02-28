/**
 * Tool Result Types - 工具调用结果类型定义
 */

import type { ToolUIPart } from "ai";

export type ToolName = ToolUIPart extends infer T
  ? T extends { type: `tool-${infer N}` }
    ? N
    : never
  : never;

export interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
}

export interface MindMapData {
  topic: string;
  maxDepth: number;
  layout: "radial" | "tree" | "mindmap";
  hasContent: boolean;
  nodes: MindMapNode;
}

export interface MindMapOutput {
  success: boolean;
  mindMap?: MindMapData;
  error?: string;
}

export interface SearchResultItem {
  id: string;
  sourceId: string;
  sourceType: "document" | "conversation";
  title: string;
  content: string;
  relevance: number;
  source?: string;
}

export interface SearchNotesOutput {
  success: boolean;
  query: string;
  count?: number;
  results: SearchResultItem[];
  message?: string;
  error?: string;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchOutput {
  success: boolean;
  query: string;
  results: WebSearchResult[];
  error?: string;
}

export interface SummaryOutput {
  success: boolean;
  summary?: {
    sourceLength: number;
    length: "brief" | "medium" | "detailed";
    style: "bullet_points" | "paragraph" | "key_takeaways";
    content: string;
  };
  error?: string;
}

export interface EditAction {
  action: "replace" | "replace_all" | "insert_after" | "insert_before" | "delete";
  targetId: string;
  newContent?: string;
}

export interface EditDocumentOutput {
  success: boolean;
  requiresConfirmation: true;
  action: string;
  targetId: string;
  newContent?: string;
  explanation: string;
  edits?: EditAction[];
  error?: string;
}

export interface BatchEditOutput {
  success: boolean;
  requiresConfirmation: true;
  explanation: string;
  edits: EditAction[];
  error?: string;
}

export interface DraftContentOutput {
  success: boolean;
  requiresConfirmation: true;
  content: string;
  targetId?: string;
  explanation: string;
  error?: string;
}

export interface CourseChapter {
  title: string;
  description: string;
  topics: string[];
}

export interface CourseOutline {
  chapters: CourseChapter[];
}

export interface GenerateCourseOutput {
  success: boolean;
  courseId?: string;
  title?: string;
  chapters?: number;
  outline?: CourseOutline;
  error?: string;
}

export interface GetNoteOutput {
  success: boolean;
  id: string;
  title: string;
  content?: string;
  updatedAt?: string;
  error?: string;
}

export interface CreateNoteOutput {
  success: boolean;
  id: string;
  title: string;
  error?: string;
}

export interface UpdateNoteOutput {
  success: boolean;
  id: string;
  error?: string;
}

export interface DeleteNoteOutput {
  success: boolean;
  id: string;
  error?: string;
}

export interface DiscoverSkillsOutput {
  success: boolean;
  count: number;
  skills: Array<{
    name: string;
    category: string;
    mastery: number;
    confidence: number;
  }>;
  error?: string;
}

export interface AnalyzeStyleOutput {
  success: boolean;
  message?: string;
  profile?: unknown;
  error?: string;
}

export interface CheckCourseProgressOutput {
  success: boolean;
  courseId: string;
  title: string;
  status: string;
  progress: string;
  isCompleted: boolean;
  currentChapter: number;
  error?: string;
}

export type ToolOutputMap = {
  mindMap: MindMapOutput;
  searchNotes: SearchNotesOutput;
  webSearch: WebSearchOutput;
  summarize: SummaryOutput;
  editDocument: EditDocumentOutput;
  batchEdit: BatchEditOutput;
  draftContent: DraftContentOutput;
  generateCourse: GenerateCourseOutput;
  getNote: GetNoteOutput;
  createNote: CreateNoteOutput;
  updateNote: UpdateNoteOutput;
  deleteNote: DeleteNoteOutput;
  discoverSkills: DiscoverSkillsOutput;
  analyzeStyle: AnalyzeStyleOutput;
  checkCourseProgress: CheckCourseProgressOutput;
};
