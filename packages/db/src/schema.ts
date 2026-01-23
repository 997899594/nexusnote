import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  customType,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

// 自定义 bytea 类型
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// halfvec: 半精度向量，支持 4000 维度 + 省 50% 存储
// 需要 pgvector 0.7.0+
const EMBEDDING_DIMENSIONS = process.env.EMBEDDING_DIMENSIONS || "4000";

export const halfvec = customType<{ data: number[] }>({
  dataType() {
    return `halfvec(${EMBEDDING_DIMENSIONS})`;
  },
});

// 用户表
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 工作区表
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 文档表
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull().default("Untitled"),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  content: bytea("content"), // Yjs 二进制状态
  plainText: text("plain_text"), // 纯文本（用于搜索和 RAG）
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 文档分块表（RAG 用）
export const documentChunks = pgTable("document_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").references(() => documents.id, {
    onDelete: "cascade",
  }),
  content: text("content").notNull(),
  embedding: halfvec("embedding"),
  chunkIndex: integer("chunk_index").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 文档快照表（时间轴）
export const documentSnapshots = pgTable("document_snapshots", {
  id: text("id").primaryKey(), // 格式: documentId-timestamp
  documentId: uuid("document_id").references(() => documents.id, {
    onDelete: "cascade",
  }),
  yjsState: bytea("yjs_state"), // Yjs 完整状态
  plainText: text("plain_text"),
  timestamp: timestamp("timestamp").notNull(),
  trigger: text("trigger").notNull(), // 'auto' | 'manual' | 'ai_edit' | 'collab_join' | 'restore'
  summary: text("summary"),
  wordCount: integer("word_count"),
  diffAdded: integer("diff_added"),
  diffRemoved: integer("diff_removed"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// 学习模块 (Learning Module)
// ============================================

// 学习内容表（书籍/课程/文章）
export const learningContents = pgTable("learning_contents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  type: text("type").notNull().default("book"), // 'book' | 'article' | 'course'
  author: text("author"),
  coverUrl: text("cover_url"),
  sourceUrl: text("source_url"), // 原始 URL（如果有）
  totalChapters: integer("total_chapters").default(1),
  difficulty: text("difficulty").default("intermediate"), // 'beginner' | 'intermediate' | 'advanced'
  estimatedMinutes: integer("estimated_minutes"),
  tags: jsonb("tags"), // JSON array
  summary: text("summary"), // AI 生成的摘要
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 学习内容章节（复用 documents 表存储实际内容）
export const learningChapters = pgTable("learning_chapters", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentId: uuid("content_id").references(() => learningContents.id, {
    onDelete: "cascade",
  }),
  documentId: uuid("document_id").references(() => documents.id), // 关联到 documents 表
  chapterIndex: integer("chapter_index").notNull(),
  title: text("title").notNull(),
  summary: text("summary"), // AI 生成的章节摘要
  keyPoints: jsonb("key_points"), // JSON array: 关键知识点
  createdAt: timestamp("created_at").defaultNow(),
});

// 学习进度表
export const learningProgress = pgTable("learning_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentId: uuid("content_id").references(() => learningContents.id, {
    onDelete: "cascade",
  }),
  currentChapter: integer("current_chapter").default(0),
  completedChapters: jsonb("completed_chapters"), // JSON array of chapter indices
  totalTimeSpent: integer("total_time_spent").default(0), // 分钟
  lastAccessedAt: timestamp("last_accessed_at").defaultNow(),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  masteryLevel: integer("mastery_level").default(0), // 0-100
});

// 学习笔记/标注（关联到章节）
export const learningHighlights = pgTable("learning_highlights", {
  id: uuid("id").primaryKey().defaultRandom(),
  chapterId: uuid("chapter_id").references(() => learningChapters.id, {
    onDelete: "cascade",
  }),
  content: text("content").notNull(), // 划线内容
  note: text("note"), // 用户笔记
  color: text("color").default("yellow"),
  position: integer("position"), // 在文档中的位置
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// SRS 间隔重复系统 (Spaced Repetition System)
// 基于 FSRS-5 算法
// ============================================

// 闪卡表
export const flashcards = pgTable("flashcards", {
  id: uuid("id").primaryKey().defaultRandom(),

  // 来源关联（二选一）
  highlightId: uuid("highlight_id").references(() => learningHighlights.id, {
    onDelete: "cascade",
  }),
  documentId: uuid("document_id").references(() => documents.id, {
    onDelete: "cascade",
  }),

  // 卡片内容
  front: text("front").notNull(), // 问题/提示
  back: text("back").notNull(), // 答案
  context: text("context"), // 上下文（来源段落）
  tags: jsonb("tags"), // JSON array

  // FSRS-5 核心参数
  state: integer("state").notNull().default(0), // 0=New, 1=Learning, 2=Review, 3=Relearning
  due: timestamp("due").notNull().defaultNow(), // 下次复习时间
  stability: integer("stability").notNull().default(0), // 记忆稳定性（天数 * 100，整数存储）
  difficulty: integer("difficulty").notNull().default(50), // 难度 0-100
  elapsedDays: integer("elapsed_days").notNull().default(0), // 距上次复习天数
  scheduledDays: integer("scheduled_days").notNull().default(0), // 计划间隔天数
  reps: integer("reps").notNull().default(0), // 成功复习次数
  lapses: integer("lapses").notNull().default(0), // 遗忘次数

  // 元数据
  suspended: timestamp("suspended"), // 暂停时间（null=活跃）
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  dueIdx: index("flashcards_due_idx").on(table.due),
  stateIdx: index("flashcards_state_idx").on(table.state),
}));

// 复习记录表（用于 FSRS 参数优化和学习分析）
export const reviewLogs = pgTable("review_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  flashcardId: uuid("flashcard_id").references(() => flashcards.id, {
    onDelete: "cascade",
  }),
  rating: integer("rating").notNull(), // 1=Again, 2=Hard, 3=Good, 4=Easy
  state: integer("state").notNull(), // 复习时的状态
  due: timestamp("due").notNull(), // 原定复习时间
  stability: integer("stability").notNull(), // 复习前稳定性
  difficulty: integer("difficulty").notNull(), // 复习前难度
  elapsedDays: integer("elapsed_days").notNull(),
  scheduledDays: integer("scheduled_days").notNull(),
  reviewDuration: integer("review_duration"), // 复习用时（毫秒）
  reviewedAt: timestamp("reviewed_at").defaultNow(),
});

// 类型导出
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
export type DocumentSnapshot = typeof documentSnapshots.$inferSelect;
export type NewDocumentSnapshot = typeof documentSnapshots.$inferInsert;
export type LearningContent = typeof learningContents.$inferSelect;
export type NewLearningContent = typeof learningContents.$inferInsert;
export type LearningChapter = typeof learningChapters.$inferSelect;
export type LearningProgress = typeof learningProgress.$inferSelect;
export type LearningHighlight = typeof learningHighlights.$inferSelect;
export type Flashcard = typeof flashcards.$inferSelect;
export type NewFlashcard = typeof flashcards.$inferInsert;
export type ReviewLog = typeof reviewLogs.$inferSelect;
export type NewReviewLog = typeof reviewLogs.$inferInsert;
