/**
 * 2026 架构师标准：AI 工具输出类型定义
 *
 * 用于消除 UI 渲染层中的 as any，提供全链路类型安全
 */

export interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
  color?: string;
}

export interface QuizQuestion {
  id: number;
  type: "multiple_choice" | "true_false" | "fill_blank";
  question: string;
  options?: string[];
  answer: string | number;
  explanation?: string;
}

export interface QuizOutput {
  success: boolean;
  quiz?: {
    topic: string;
    difficulty: "easy" | "medium" | "hard";
    questionCount: number;
    requestedTypes: string[];
    message: string;
    questions?: QuizQuestion[];
  };
}

export interface MindMapOutput {
  success: boolean;
  mindMap?: {
    topic: string;
    maxDepth: number;
    layout: "radial" | "tree" | "mindmap";
    hasContent: boolean;
    message: string;
    nodes?: MindMapNode[];
  };
}

export interface SummarizeOutput {
  success: boolean;
  summary?: {
    sourceLength: number;
    targetLength: string;
    length: "brief" | "medium" | "detailed";
    style: "bullet_points" | "paragraph" | "key_takeaways";
    preserveStructure: boolean;
    language: string;
    message: string;
    content?: string;
  };
}

export interface WebSearchOutput {
  success: boolean;
  query: string;
  answer?: string;
  results?: Array<{
    title: string;
    url: string;
    content: string;
    score?: number;
    publishedDate?: string;
  }>;
  searchDepth?: "basic" | "advanced";
  message?: string;
}

export interface FlashcardOutput {
  success: boolean;
  count: number;
  cards: Array<{
    id: string;
    front: string;
    back: string;
  }>;
}

export interface SearchNotesOutput {
  success: boolean;
  query: string;
  results: Array<{
    title: string;
    content: string;
    documentId: string;
    relevance: number;
  }>;
}

export interface ReviewStatsOutput {
  success: boolean;
  totalCards: number;
  dueToday: number;
  newCards: number;
  learningCards: number;
  masteredCards: number;
  retention: number;
  streak: number;
}

export interface LearningPlanOutput {
  success: boolean;
  topic: string;
  duration: string;
  level: "beginner" | "intermediate" | "advanced";
}

export interface EditDocumentOutput {
  success: boolean;
  action: string;
  targetId: string;
  newContent?: string;
  explanation: string;
}

export interface BatchEditOutput {
  success: boolean;
  edits: Array<{
    action: string;
    targetId: string;
    newContent?: string;
  }>;
  explanation: string;
}

export interface DraftContentOutput {
  success: boolean;
  content: string;
  targetId?: string;
  explanation: string;
}
