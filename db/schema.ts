import { relations } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { env } from "@/config/env";
import type { EMAValue } from "@/types/profile";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const EMBEDDING_DIMENSIONS = env.EMBEDDING_DIMENSIONS || 4000;

export const halfvec = customType<{ data: number[] }>({
  dataType() {
    return `vector(${EMBEDDING_DIMENSIONS})`;
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

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull()
      .unique(),

    learningStyle: jsonb("learning_style"),

    vocabularyComplexity: jsonb("vocabulary_complexity").$type<EMAValue>(),
    sentenceComplexity: jsonb("sentence_complexity").$type<EMAValue>(),
    abstractionLevel: jsonb("abstraction_level").$type<EMAValue>(),

    directness: jsonb("directness").$type<EMAValue>(),
    conciseness: jsonb("conciseness").$type<EMAValue>(),
    formality: jsonb("formality").$type<EMAValue>(),
    emotionalIntensity: jsonb("emotional_intensity").$type<EMAValue>(),

    openness: jsonb("openness").$type<EMAValue>(),
    conscientiousness: jsonb("conscientiousness").$type<EMAValue>(),
    extraversion: jsonb("extraversion").$type<EMAValue>(),
    agreeableness: jsonb("agreeableness").$type<EMAValue>(),
    neuroticism: jsonb("neuroticism").$type<EMAValue>(),

    totalMessagesAnalyzed: integer("total_messages_analyzed").notNull().default(0),
    totalConversationsAnalyzed: integer("total_conversations_analyzed").notNull().default(0),
    lastAnalyzedAt: timestamp("last_analyzed_at"),

    updatedAt: timestamp("updated_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("user_profiles_user_id_idx").on(table.userId),
  }),
);

// ============================================
// 风格分析隐私设置
// ============================================

export const stylePrivacySettings = pgTable(
  "style_privacy_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull()
      .unique(),

    analysisEnabled: boolean("analysis_enabled").notNull().default(false),
    consentGivenAt: timestamp("consent_given_at"),

    bigFiveEnabled: boolean("big_five_enabled").notNull().default(false),
    bigFiveConsentGivenAt: timestamp("big_five_consent_given_at"),

    autoDeleteAfterDays: integer("auto_delete_after_days"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("style_privacy_settings_user_id_idx").on(table.userId),
  }),
);

// ============================================
// AI 角色系统
// ============================================

export const personas = pgTable(
  "personas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    avatar: text("avatar"),
    systemPrompt: text("system_prompt").notNull(),
    style: text("style"),
    examples: jsonb("examples").$type<string[]>().default([]),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    isBuiltIn: boolean("is_built_in").notNull().default(false),
    isEnabled: boolean("is_enabled").notNull().default(true),
    version: text("version").default("1.0.0"),
    usageCount: integer("usage_count").notNull().default(0),
    rating: jsonb("rating").$type<{ total: number; count: number }>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    slugIdx: index("personas_slug_idx").on(table.slug),
    authorIdIdx: index("personas_author_id_idx").on(table.authorId),
    isEnabledIdx: index("personas_is_enabled_idx").on(table.isEnabled),
  }),
);

export const userPersonaPreferences = pgTable(
  "user_persona_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    defaultPersonaSlug: text("default_persona_slug").notNull().default("default"),
    lastSwitchedAt: timestamp("last_switched_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("user_persona_preferences_user_id_idx").on(table.userId),
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
// 文档系统（统一：document | course_chapter）
// ============================================

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull().default("document"),
    title: text("title").notNull().default("Untitled"),
    workspaceId: uuid("workspace_id").references(() => workspaces.id),

    content: bytea("content"),
    plainText: text("plain_text"),

    courseId: uuid("course_id"),
    outlineNodeId: text("outline_node_id"),

    summaries:
      jsonb("summaries").$type<
        {
          type: "summary" | "note";
          content: string;
          tags: string[];
          createdAt: string;
        }[]
      >(),

    isVault: boolean("is_vault").notNull().default(false),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    typeIdx: index("documents_type_idx").on(table.type),
    courseIdIdx: index("documents_course_id_idx").on(table.courseId),
  }),
);

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
// 标签系统
// ============================================

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    nameEmbedding: halfvec("name_embedding"),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    nameIdx: index("tags_name_idx").on(table.name),
  }),
);

export const documentTags = pgTable(
  "document_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    confidence: real("confidence").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow(),
    confirmedAt: timestamp("confirmed_at"),
  },
  (table) => ({
    documentIdx: index("document_tags_document_idx").on(table.documentId),
    tagIdx: index("document_tags_tag_idx").on(table.tagId),
    statusIdx: index("document_tags_status_idx").on(table.status),
    uniqueDocumentTag: index("document_tags_unique_idx").on(table.documentId, table.tagId),
  }),
);

// ============================================
// 聊天会话
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

    titleGeneratedAt: timestamp("title_generated_at"),
  },
  (table) => ({
    userIdIdx: index("conversations_user_id_idx").on(table.userId),
    lastMessageIdx: index("conversations_last_message_idx").on(table.lastMessageAt),
  }),
);

// ============================================
// 统一知识库 (Knowledge Chunks)
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

export const documentChunks = knowledgeChunks;

// ============================================
// AI 生成课程 (Course Profiles)
// ============================================

// 访谈画像类型 - 2026 自适应访谈系统
export type DomainComplexity = "trivial" | "simple" | "moderate" | "complex" | "expert";
export type LearningLevel = "none" | "beginner" | "intermediate" | "advanced";

export interface InterviewProfile {
  // 核心信息（所有领域通用）
  goal: string | null;
  domain: string | null;
  complexity: DomainComplexity;

  // 背景信息（按需收集）
  background: string | null;
  currentLevel: LearningLevel;

  // 目标信息（按需收集）
  targetOutcome: string | null;
  timeConstraints: string | null;

  // AI 推断
  insights: string[];
  readiness: number; // 0-100

  // 元数据
  estimatedTurns: number;
  currentTurn: number;
}

export const courseSessions = pgTable(
  "course_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),

    title: text("title"),
    description: text("description"),
    difficulty: text("difficulty").default("intermediate"),
    estimatedMinutes: integer("estimated_minutes"),

    interviewProfile: jsonb("interview_profile").$type<InterviewProfile>(),
    interviewStatus: text("interview_status").default("interviewing"),

    outlineData: jsonb("outline_data"),

    status: text("status").notNull().default("idle"),

    progress: jsonb("progress").$type<{
      currentChapter: number;
      completedChapters: number[];
      totalChapters: number;
      startedAt: string;
      completedAt: string;
    }>(),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("course_sessions_user_id_idx").on(table.userId),
  }),
);

// ============================================
// Topic Blueprints (动态评分蓝图)
// ============================================

export const topicBlueprints = pgTable(
  "topic_blueprints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topic: text("topic").notNull(),
    topicHash: text("topic_hash").notNull().unique(),

    // 核心维度 (JSONB)
    coreDimensions: jsonb("core_dimensions")
      .$type<
        Array<{
          name: string;
          keywords: string[];
          weight: number;
          suggestion: string;
        }>
      >()
      .notNull(),

    // 状态：pending/ready/failed
    status: text("status").notNull().default("pending"),

    // 暂存事实（冷启动期）
    pendingFacts: jsonb("pending_facts").$type<
      Array<{
        dimension: string;
        value: string | number | boolean;
        type: "string" | "number" | "boolean";
        confidence: number;
        extractedAt: string;
        topicId: string;
        isShared: boolean;
      }>
    >(),

    // 元数据
    modelUsed: text("model_used").notNull().default("gemini-3-flash"),
    errorMessage: text("error_message"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    topicHashIdx: index("topic_blueprints_topic_hash_idx").on(table.topicHash),
    statusIdx: index("topic_blueprints_status_idx").on(table.status),
  }),
);

// ============================================
// 技能图系统
// ============================================

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    category: text("category"),
    domain: text("domain"),
    description: text("description"),
    icon: text("icon"),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    categoryIdx: index("skills_category_idx").on(table.category),
  }),
);

export const skillRelationships = pgTable(
  "skill_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceSkillId: uuid("source_skill_id")
      .references(() => skills.id, { onDelete: "cascade" })
      .notNull(),
    targetSkillId: uuid("target_skill_id")
      .references(() => skills.id, { onDelete: "cascade" })
      .notNull(),
    relationshipType: text("relationship_type").notNull(),
    strength: integer("strength").notNull().default(50),
    confidence: integer("confidence").notNull().default(50),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    sourceIdx: index("skill_relationships_source_idx").on(table.sourceSkillId),
    targetIdx: index("skill_relationships_target_idx").on(table.targetSkillId),
    uniqueRelation: index("skill_relationships_unique_idx").on(
      table.sourceSkillId,
      table.targetSkillId,
      table.relationshipType,
    ),
  }),
);

export const userSkillMastery = pgTable(
  "user_skill_mastery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    skillId: uuid("skill_id")
      .references(() => skills.id, { onDelete: "cascade" })
      .notNull(),
    level: integer("level").notNull().default(0),
    experience: integer("experience").notNull().default(0),
    evidence: jsonb("evidence").$type<string[]>().notNull().default([]),
    confidence: integer("confidence").notNull().default(0),
    unlockedAt: timestamp("unlocked_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("user_skill_mastery_user_idx").on(table.userId),
    skillIdx: index("user_skill_mastery_skill_idx").on(table.skillId),
    uniqueUserSkill: index("user_skill_mastery_unique_idx").on(table.userId, table.skillId),
  }),
);

// ============================================
// AI 使用量追踪
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

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type DocumentTag = typeof documentTags.$inferSelect;
export type NewDocumentTag = typeof documentTags.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type NewKnowledgeChunk = typeof knowledgeChunks.$inferInsert;

export type DocumentChunk = KnowledgeChunk;
export type NewDocumentChunk = NewKnowledgeChunk;

export type AIUsage = typeof aiUsage.$inferSelect;
export type NewAIUsage = typeof aiUsage.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type StylePrivacySettings = typeof stylePrivacySettings.$inferSelect;
export type NewStylePrivacySettings = typeof stylePrivacySettings.$inferInsert;
export type Persona = typeof personas.$inferSelect;
export type NewPersona = typeof personas.$inferInsert;
export type UserPersonaPreference = typeof userPersonaPreferences.$inferSelect;
export type NewUserPersonaPreference = typeof userPersonaPreferences.$inferInsert;
export type CourseSession = typeof courseSessions.$inferSelect;
export type NewCourseSession = typeof courseSessions.$inferInsert;
export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type SkillRelationship = typeof skillRelationships.$inferSelect;
export type NewSkillRelationship = typeof skillRelationships.$inferInsert;
export type UserSkillMastery = typeof userSkillMastery.$inferSelect;
export type NewUserSkillMastery = typeof userSkillMastery.$inferInsert;

// ============================================
// Relations
// ============================================

export const usersRelations = relations(users, ({ many }) => ({
  courseSessions: many(courseSessions),
  workspaces: many(workspaces),
  conversations: many(conversations),
  knowledgeChunks: many(knowledgeChunks),
  userProfiles: many(userProfiles),
  stylePrivacySettings: many(stylePrivacySettings),
  createdPersonas: many(personas),
  personaPreference: many(userPersonaPreferences),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [documents.workspaceId],
    references: [workspaces.id],
  }),
  tags: many(documentTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  documentTags: many(documentTags),
}));

export const documentTagsRelations = relations(documentTags, ({ one }) => ({
  document: one(documents, {
    fields: [documentTags.documentId],
    references: [documents.id],
  }),
  tag: one(tags, {
    fields: [documentTags.tagId],
    references: [tags.id],
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

export const courseSessionsRelations = relations(courseSessions, ({ one }) => ({
  user: one(users, {
    fields: [courseSessions.userId],
    references: [users.id],
  }),
}));

export const stylePrivacySettingsRelations = relations(stylePrivacySettings, ({ one }) => ({
  user: one(users, {
    fields: [stylePrivacySettings.userId],
    references: [users.id],
  }),
}));

export const skillsRelations = relations(skills, ({ many }) => ({
  sourceRelationships: many(skillRelationships, {
    relationName: "sourceRelationships",
  }),
  targetRelationships: many(skillRelationships, {
    relationName: "targetRelationships",
  }),
  userMastery: many(userSkillMastery),
}));

export const skillRelationshipsRelations = relations(skillRelationships, ({ one }) => ({
  sourceSkill: one(skills, {
    fields: [skillRelationships.sourceSkillId],
    references: [skills.id],
    relationName: "sourceRelationships",
  }),
  targetSkill: one(skills, {
    fields: [skillRelationships.targetSkillId],
    references: [skills.id],
    relationName: "targetRelationships",
  }),
}));

export const userSkillMasteryRelations = relations(userSkillMastery, ({ one }) => ({
  user: one(users, {
    fields: [userSkillMastery.userId],
    references: [users.id],
  }),
  skill: one(skills, {
    fields: [userSkillMastery.skillId],
    references: [skills.id],
  }),
}));

export const personasRelations = relations(personas, ({ one, many }) => ({
  author: one(users, {
    fields: [personas.authorId],
    references: [users.id],
  }),
  userPreferences: many(userPersonaPreferences),
}));

export const userPersonaPreferencesRelations = relations(userPersonaPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPersonaPreferences.userId],
    references: [users.id],
  }),
}));
