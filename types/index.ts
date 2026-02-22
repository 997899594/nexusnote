/**
 * Global Types - 跨模块共享类型
 */

export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
}

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Intent = "CHAT" | "INTERVIEW" | "COURSE" | "SEARCH";

export type LoadingStatus = "idle" | "loading" | "success" | "error";

// ============================================
// Document & Editor Types
// ============================================

/**
 * Parsed document block for AI editing
 */
export interface DocumentBlock {
  id: string; // Unique identifier (e.g., "p-0", "h1-1", "list-2")
  type: string; // Node type (paragraph, heading, bulletList, etc.)
  level?: number; // Heading level (1-6)
  content: string; // Plain text content
  from: number; // ProseMirror start position
  to: number; // ProseMirror end position
  index: number; // Index within same type blocks
  globalIndex: number; // Global block index
}

/**
 * Parsed document structure
 */
export interface DocumentStructure {
  blocks: DocumentBlock[];
  totalBlocks: number;
  headings: DocumentBlock[];
  paragraphs: DocumentBlock[];
}

/**
 * AI edit command
 */
export interface EditCommand {
  action: "replace" | "insert_after" | "insert_before" | "delete" | "replace_all";
  targetId: string; // Target block ID ('document' for replace_all)
  targetRef?: string; // Original natural language reference
  newContent?: string; // New content (required for replace/insert)
  explanation?: string; // AI explanation of the edit
}

// ============================================
// Snapshot Types
// ============================================

export type SnapshotTrigger = "auto" | "manual" | "ai_edit" | "collab_join" | "restore";

export interface DocumentSnapshotBase {
  id: string;
  documentId: string;
  trigger: SnapshotTrigger;
  description?: string;
  createdAt: Date | string;
}

// ============================================
// SRS / Flashcard Types
// ============================================

/**
 * FSRS Card State
 * 0: New, 1: Learning, 2: Review, 3: Relearning
 */
export type CardState = 0 | 1 | 2 | 3;

/**
 * Review Rating
 * 1: Again, 2: Hard, 3: Good, 4: Easy
 */
export type ReviewRating = 1 | 2 | 3 | 4;

/**
 * FSRS Card scheduling parameters
 */
export interface FSRSCard {
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: CardState;
  last_review?: Date;
}

/**
 * FSRS Review log entry
 */
export interface FSRSReviewLog {
  rating: ReviewRating;
  state: CardState;
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  last_elapsed_days: number;
  scheduled_days: number;
  review: Date;
}

/**
 * Scheduling result for a single rating
 */
export interface SchedulingInfo {
  card: FSRSCard;
  log: FSRSReviewLog;
}

/**
 * All scheduling options after a review
 */
export interface SchedulingCards {
  again: SchedulingInfo;
  hard: SchedulingInfo;
  good: SchedulingInfo;
  easy: SchedulingInfo;
}

// ============================================
// Learning Module Types
// ============================================

export type LearningContentType = "book" | "article" | "course";
export type LearningDifficulty = "beginner" | "intermediate" | "advanced";

export interface LearningContentBase {
  id: string;
  title: string;
  type: LearningContentType;
  difficulty: LearningDifficulty;
  description?: string;
  coverImage?: string;
  totalChapters: number;
  estimatedHours: number;
}

export interface LearningProgressBase {
  contentId: string;
  currentChapter: number;
  completedChapters: number[];
  totalTimeSpent: number;
  masteryLevel: number;
  lastAccessedAt: Date | string;
}

// ============================================
// Collaboration Types
// ============================================

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  avatar?: string;
}

// ============================================
// RAG / AI Types
// ============================================

/**
 * RAG index job payload
 */
export interface RagIndexJob {
  documentId: string;
  content: string;
  title: string;
}

/**
 * RAG search result item
 */
export interface RagSearchResult {
  content: string;
  documentId: string;
  documentTitle: string;
  similarity: number;
}

/**
 * AI Provider identifiers
 */
export type AIProvider = "openai" | "deepseek" | "302ai" | "siliconflow";

/**
 * AI Skill names
 */
export type SkillName =
  | "createFlashcards"
  | "searchNotes"
  | "getReviewStats"
  | "createLearningPlan";

// ============================================
// Health Check Types
// ============================================

export interface HealthCheck {
  name: string;
  status: "healthy" | "unhealthy" | "degraded";
  message?: string;
}

export interface HealthStatus {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  checks: HealthCheck[];
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
