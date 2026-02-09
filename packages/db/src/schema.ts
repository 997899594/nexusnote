import { env } from "@nexusnote/config";
import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  customType,
  index,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";

// 自定义 bytea 类型
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// halfvec: 半精度向量，4000 维度，省 50% 存储
// 需要 pgvector 0.5.0+
//
// ⚠️ Drizzle bug: customType 会给类型名加引号导致迁移失败
// 生成迁移后需手动修复：sed -i 's/"halfvec(4000)"/halfvec(4000)/g' drizzle/*.sql
const EMBEDDING_DIMENSIONS = env.EMBEDDING_DIMENSIONS || 4000;

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
  isVault: boolean("is_vault").notNull().default(false), // 是否为隐私保险箱内容
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

// ============================================
// AI 生成课程 (AI-Generated Courses)
// Interview Agent 的课程配置文件
// ============================================

// 课程用户画像表 - 保存 Interview Agent 收集的用户信息和生成的课程大纲
export const courseProfiles = pgTable(
  "course_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),

    // 用户画像维度（Interview Agent 收集）
    goal: text("goal").notNull(), // 学什么
    background: text("background").notNull(), // 基础水平
    targetOutcome: text("target_outcome").notNull(), // 预期成果
    cognitiveStyle: text("cognitive_style").notNull(), // 学习风格

    // 课程元数据（generateOutline 工具生成）
    title: text("title").notNull(),
    description: text("description"),
    difficulty: text("difficulty").notNull().default("intermediate"), // beginner | intermediate | advanced
    estimatedMinutes: integer("estimated_minutes").notNull(),

    // 完整的大纲数据（JSON 格式，Tiptap 渲染）
    outlineData: jsonb("outline_data").notNull(), // 完整大纲结构
    outlineMarkdown: text("outline_markdown"), // Markdown 格式的大纲（用于流式渲染）

    // 生成理由（说明为什么这样设计课程）
    designReason: text("design_reason"),

    // 课程生成进度
    currentChapter: integer("current_chapter").default(0),
    currentSection: integer("current_section").default(1),
    isCompleted: boolean("is_completed").default(false),

    // 元数据
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("course_profiles_user_id_idx").on(table.userId),
  }),
);

// 课程章节内容表 - 存储生成的课程具体内容
export const courseChapters = pgTable(
  "course_chapters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").references(() => courseProfiles.id, {
      onDelete: "cascade",
    }),
    chapterIndex: integer("chapter_index").notNull(),
    sectionIndex: integer("section_index").notNull(),

    // 章节元数据
    title: text("title").notNull(),
    contentMarkdown: text("content_markdown").notNull(), // Markdown 格式的内容（用于 Tiptap 渲染）

    // 生成状态
    isGenerated: boolean("is_generated").default(true),
    generatedAt: timestamp("generated_at").defaultNow(),

    // 元数据
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    profileIdIdx: index("course_chapters_profile_id_idx").on(table.profileId),
    chapterIdx: index("course_chapters_chapter_idx").on(table.chapterIndex),
  }),
);

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
export const flashcards = pgTable(
  "flashcards",
  {
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
  },
  (table) => ({
    dueIdx: index("flashcards_due_idx").on(table.due),
    stateIdx: index("flashcards_state_idx").on(table.state),
  }),
);

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

// ============================================
// 液态知识系统 (Liquid Knowledge System)
// NexusNote 3.1 - 幽灵飞梭 + AI 园艺
// ============================================

// AI 维护的语义主题簇
export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(), // AI 生成的主题名
    embedding: halfvec("embedding"), // 主题的中心向量 (4000维)
    noteCount: integer("note_count").default(0),
    lastActiveAt: timestamp("last_active_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("topics_user_id_idx").on(table.userId),
  }),
);

// 提取的知识片段
export const extractedNotes = pgTable(
  "extracted_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    content: text("content").notNull(), // 提取的文本内容
    embedding: halfvec("embedding"), // 文本向量 (4000维)

    // 来源追溯 (支持两种来源)
    sourceType: text("source_type").notNull(), // 'document' | 'learning'
    sourceDocumentId: uuid("source_document_id").references(
      () => documents.id,
      {
        onDelete: "set null",
      },
    ),
    sourceChapterId: uuid("source_chapter_id").references(
      () => learningChapters.id,
      {
        onDelete: "set null",
      },
    ),
    sourcePosition: jsonb("source_position"), // { from: number, to: number }

    // AI 分类
    topicId: uuid("topic_id").references(() => topics.id, {
      onDelete: "set null",
    }),
    status: text("status").default("processing"), // 'processing' | 'classified'

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    topicIdIdx: index("extracted_notes_topic_id_idx").on(table.topicId),
    statusIdx: index("extracted_notes_status_idx").on(table.status),
    userIdIdx: index("extracted_notes_user_id_idx").on(table.userId),
  }),
);

// ============================================
// AI 使用量追踪 (AI Usage Tracking)
// ============================================

// AI 调用记录表 - 用于成本追踪和速率限制分析
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),

    // 调用信息
    endpoint: text("endpoint").notNull(), // '/api/ai', '/api/completion', etc.
    intent: text("intent"), // 'CHAT', 'INTERVIEW', 'EDITOR', etc.
    model: text("model").notNull(), // 'gemini-3-flash-preview', etc.

    // Token 使用量
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),

    // 成本（美分）
    costCents: integer("cost_cents").notNull().default(0),

    // 请求元数据
    durationMs: integer("duration_ms"), // 请求耗时
    success: boolean("success").notNull().default(true),
    errorMessage: text("error_message"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("ai_usage_user_id_idx").on(table.userId),
    endpointIdx: index("ai_usage_endpoint_idx").on(table.endpoint),
    createdAtIdx: index("ai_usage_created_at_idx").on(table.createdAt),
  }),
);

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

// Liquid Knowledge types
export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
export type ExtractedNote = typeof extractedNotes.$inferSelect;
export type NewExtractedNote = typeof extractedNotes.$inferInsert;

// AI Usage types
export type AIUsage = typeof aiUsage.$inferSelect;
export type NewAIUsage = typeof aiUsage.$inferInsert;

// ============================================
// Relations
// ============================================

export const topicsRelations = relations(topics, ({ many }) => ({
  notes: many(extractedNotes),
}));

export const extractedNotesRelations = relations(extractedNotes, ({ one }) => ({
  topic: one(topics, {
    fields: [extractedNotes.topicId],
    references: [topics.id],
  }),
  user: one(users, {
    fields: [extractedNotes.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  topics: many(topics),
  extractedNotes: many(extractedNotes),
  courseProfiles: many(courseProfiles),
  workspaces: many(workspaces),
}));

export const courseProfilesRelations = relations(
  courseProfiles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [courseProfiles.userId],
      references: [users.id],
    }),
    chapters: many(courseChapters),
  }),
);

export const courseChaptersRelations = relations(courseChapters, ({ one }) => ({
  profile: one(courseProfiles, {
    fields: [courseChapters.profileId],
    references: [courseProfiles.id],
  }),
}));

// Workspace & Documents relations
export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [documents.workspaceId],
    references: [workspaces.id],
  }),
}));
