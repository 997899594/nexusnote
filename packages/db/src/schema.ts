import { env } from "@nexusnote/config";
import { relations } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
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

// ============================================
// 用户 & 工作区
// ============================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User learning profile - accumulates cross-course learning data
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    learningGoals: jsonb("learning_goals"),
    knowledgeAreas: jsonb("knowledge_areas"),
    learningStyle: jsonb("learning_style"),
    assessmentHistory: jsonb("assessment_history"),
    currentLevel: text("current_level"),
    totalStudyMinutes: integer("total_study_minutes").notNull().default(0),
    profileEmbedding: halfvec("profile_embedding"),
    updatedAt: timestamp("updated_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("user_profiles_user_id_idx").on(table.userId),
  }),
);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// 文档系统
// ============================================

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull().default("Untitled"),
  workspaceId: uuid("workspace_id").references(() => workspaces.id),
  content: bytea("content"),
  plainText: text("plain_text"),
  isVault: boolean("is_vault").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documentSnapshots = pgTable("document_snapshots", {
  id: text("id").primaryKey(),
  documentId: uuid("document_id").references(() => documents.id, {
    onDelete: "cascade",
  }),
  yjsState: bytea("yjs_state"),
  plainText: text("plain_text"),
  timestamp: timestamp("timestamp").notNull(),
  trigger: text("trigger").notNull(),
  summary: text("summary"),
  wordCount: integer("word_count"),
  diffAdded: integer("diff_added"),
  diffRemoved: integer("diff_removed"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// 聊天会话 (Chat Conversations)
// ============================================

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),

    title: text("title").notNull().default("新对话"),
    intent: text("intent").notNull().default("CHAT"),

    summary: text("summary"),
    messageCount: integer("message_count").default(0),
    lastMessageAt: timestamp("last_message_at").defaultNow(),

    messages: jsonb("messages").notNull().default([]),
    metadata: jsonb("metadata"),

    isArchived: boolean("is_archived").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("conversations_user_id_idx").on(table.userId),
    lastMessageIdx: index("conversations_last_message_idx").on(table.lastMessageAt),
  }),
);

// ============================================
// 统一知识库 (Knowledge Chunks)
// 支持多来源：document | conversation | note | course | flashcard
// ============================================

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    sourceType: text("source_type").notNull().default("document"),
    sourceId: uuid("source_id").notNull(),

    content: text("content").notNull(),
    embedding: halfvec("embedding"),
    chunkIndex: integer("chunk_index").notNull(),

    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),

    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    sourceIdx: index("knowledge_chunks_source_idx").on(table.sourceType, table.sourceId),
    userIdIdx: index("knowledge_chunks_user_id_idx").on(table.userId),
  }),
);

// 向后兼容别名
export const documentChunks = knowledgeChunks;

// ============================================
// 学习模块 (Learning Module)
// ============================================

export const learningContents = pgTable("learning_contents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  type: text("type").notNull().default("book"),
  author: text("author"),
  coverUrl: text("cover_url"),
  sourceUrl: text("source_url"),
  totalChapters: integer("total_chapters").default(1),
  difficulty: text("difficulty").default("intermediate"),
  estimatedMinutes: integer("estimated_minutes"),
  tags: jsonb("tags"),
  summary: text("summary"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const learningChapters = pgTable("learning_chapters", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentId: uuid("content_id").references(() => learningContents.id, {
    onDelete: "cascade",
  }),
  documentId: uuid("document_id").references(() => documents.id),
  chapterIndex: integer("chapter_index").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  keyPoints: jsonb("key_points"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const learningProgress = pgTable("learning_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentId: uuid("content_id").references(() => learningContents.id, {
    onDelete: "cascade",
  }),
  currentChapter: integer("current_chapter").default(0),
  completedChapters: jsonb("completed_chapters"),
  totalTimeSpent: integer("total_time_spent").default(0),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow(),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  masteryLevel: integer("mastery_level").default(0),
});

// ============================================
// AI 生成课程 (AI-Generated Courses)
// ============================================

export const courseProfiles = pgTable(
  "course_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),

    title: text("title"),
    description: text("description"),
    difficulty: text("difficulty").default("intermediate"),
    estimatedMinutes: integer("estimated_minutes"),

    outlineData: jsonb("outline_data"),
    outlineMarkdown: text("outline_markdown"),
    designReason: text("design_reason"),

    interviewProfile: jsonb("interview_profile"),
    interviewMessages: jsonb("interview_messages"),
    interviewStatus: text("interview_status").default("interviewing"),

    currentChapter: integer("current_chapter").default(0),
    currentSection: integer("current_section").default(1),
    isCompleted: boolean("is_completed").default(false),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("course_profiles_user_id_idx").on(table.userId),
  }),
);

export const courseChapters = pgTable(
  "course_chapters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").references(() => courseProfiles.id, {
      onDelete: "cascade",
    }),
    chapterIndex: integer("chapter_index").notNull(),
    sectionIndex: integer("section_index").notNull(),

    title: text("title").notNull(),
    contentMarkdown: text("content_markdown").notNull(),

    isGenerated: boolean("is_generated").default(true),
    generatedAt: timestamp("generated_at").defaultNow(),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    profileIdIdx: index("course_chapters_profile_id_idx").on(table.profileId),
    chapterIdx: index("course_chapters_chapter_idx").on(table.chapterIndex),
  }),
);

export const learningHighlights = pgTable("learning_highlights", {
  id: uuid("id").primaryKey().defaultRandom(),
  chapterId: uuid("chapter_id").references(() => learningChapters.id, {
    onDelete: "cascade",
  }),
  content: text("content").notNull(),
  note: text("note"),
  color: text("color").default("yellow"),
  position: integer("position"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// SRS 间隔重复系统 (Spaced Repetition System)
// ============================================

export const flashcards = pgTable(
  "flashcards",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    highlightId: uuid("highlight_id").references(() => learningHighlights.id, {
      onDelete: "cascade",
    }),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "cascade",
    }),

    front: text("front").notNull(),
    back: text("back").notNull(),
    context: text("context"),
    tags: jsonb("tags"),

    state: integer("state").notNull().default(0),
    due: timestamp("due").notNull().defaultNow(),
    stability: integer("stability").notNull().default(0),
    difficulty: integer("difficulty").notNull().default(50),
    elapsedDays: integer("elapsed_days").notNull().default(0),
    scheduledDays: integer("scheduled_days").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),

    suspended: timestamp("suspended"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    dueIdx: index("flashcards_due_idx").on(table.due),
    stateIdx: index("flashcards_state_idx").on(table.state),
  }),
);

export const reviewLogs = pgTable("review_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  flashcardId: uuid("flashcard_id").references(() => flashcards.id, {
    onDelete: "cascade",
  }),
  rating: integer("rating").notNull(),
  state: integer("state").notNull(),
  due: timestamp("due").notNull(),
  stability: integer("stability").notNull(),
  difficulty: integer("difficulty").notNull(),
  elapsedDays: integer("elapsed_days").notNull(),
  scheduledDays: integer("scheduled_days").notNull(),
  reviewDuration: integer("review_duration"),
  reviewedAt: timestamp("reviewed_at").defaultNow(),
});

// ============================================
// 液态知识系统 (Liquid Knowledge System)
// ============================================

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    embedding: halfvec("embedding"),
    noteCount: integer("note_count").default(0),
    lastActiveAt: timestamp("last_active_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("topics_user_id_idx").on(table.userId),
  }),
);

export const extractedNotes = pgTable(
  "extracted_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    content: text("content").notNull(),
    embedding: halfvec("embedding"),

    sourceType: text("source_type").notNull(),
    sourceDocumentId: uuid("source_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    sourceChapterId: uuid("source_chapter_id").references(() => learningChapters.id, {
      onDelete: "set null",
    }),
    sourcePosition: jsonb("source_position"),

    topicId: uuid("topic_id").references(() => topics.id, {
      onDelete: "set null",
    }),
    status: text("status").default("processing"),

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

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),

    endpoint: text("endpoint").notNull(),
    intent: text("intent"),
    model: text("model").notNull(),

    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),

    costCents: integer("cost_cents").notNull().default(0),

    durationMs: integer("duration_ms"),
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

// ============================================
// 类型导出
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentSnapshot = typeof documentSnapshots.$inferSelect;
export type NewDocumentSnapshot = typeof documentSnapshots.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type NewKnowledgeChunk = typeof knowledgeChunks.$inferInsert;

export type DocumentChunk = KnowledgeChunk;
export type NewDocumentChunk = NewKnowledgeChunk;

export type LearningContent = typeof learningContents.$inferSelect;
export type NewLearningContent = typeof learningContents.$inferInsert;
export type LearningChapter = typeof learningChapters.$inferSelect;
export type LearningProgress = typeof learningProgress.$inferSelect;
export type LearningHighlight = typeof learningHighlights.$inferSelect;
export type Flashcard = typeof flashcards.$inferSelect;
export type NewFlashcard = typeof flashcards.$inferInsert;
export type ReviewLog = typeof reviewLogs.$inferSelect;
export type NewReviewLog = typeof reviewLogs.$inferInsert;
export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
export type ExtractedNote = typeof extractedNotes.$inferSelect;
export type NewExtractedNote = typeof extractedNotes.$inferInsert;
export type AIUsage = typeof aiUsage.$inferSelect;
export type NewAIUsage = typeof aiUsage.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

// ============================================
// Relations
// ============================================

export const usersRelations = relations(users, ({ many }) => ({
  topics: many(topics),
  extractedNotes: many(extractedNotes),
  courseProfiles: many(courseProfiles),
  workspaces: many(workspaces),
  conversations: many(conversations),
  knowledgeChunks: many(knowledgeChunks),
  userProfiles: many(userProfiles),
}));

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

export const conversationsRelations = relations(conversations, ({ one }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
}));

export const knowledgeChunksRelations = relations(knowledgeChunks, ({ one }) => ({
  user: one(users, {
    fields: [knowledgeChunks.userId],
    references: [users.id],
  }),
}));

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

export const courseProfilesRelations = relations(courseProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [courseProfiles.userId],
    references: [users.id],
  }),
  chapters: many(courseChapters),
}));

export const courseChaptersRelations = relations(courseChapters, ({ one }) => ({
  profile: one(courseProfiles, {
    fields: [courseChapters.profileId],
    references: [courseProfiles.id],
  }),
}));
