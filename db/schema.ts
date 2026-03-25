import { relations } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
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

// Production migrations currently use pgvector's vector(4000) columns.
// Keep schema aligned with the real database type to avoid cast/index drift.
export const embeddingVector = customType<{ data: number[] }>({
  dataType() {
    return `vector(${EMBEDDING_DIMENSIONS})`;
  },
});

// ============================================
// 用户
// ============================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Auth.js adapter tables
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

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

// ============================================
// 笔记系统
// ============================================

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull().default("Untitled"),
    sourceType: text("source_type").notNull().default("manual"),
    sourceContext: jsonb("source_context").$type<{
      courseId?: string;
      courseTitle?: string;
      sectionId?: string;
      sectionTitle?: string;
      selectionText?: string;
      anchor?: {
        textContent: string;
        startOffset: number;
        endOffset: number;
      };
      annotationId?: string;
      noteContent?: string;
    }>(),
    plainText: text("plain_text"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("notes_user_id_idx").on(table.userId),
    sourceTypeIdx: index("notes_source_type_idx").on(table.sourceType),
  }),
);

export const noteSnapshots = pgTable("note_snapshots", {
  id: text("id").primaryKey(),
  noteId: uuid("note_id").references(() => notes.id, {
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
    nameEmbedding: embeddingVector("name_embedding"),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    nameIdx: index("tags_name_idx").on(table.name),
  }),
);

export const noteTags = pgTable(
  "note_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    noteId: uuid("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    confidence: real("confidence").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow(),
    confirmedAt: timestamp("confirmed_at"),
  },
  (table) => ({
    noteIdx: index("note_tags_note_idx").on(table.noteId),
    tagIdx: index("note_tags_tag_idx").on(table.tagId),
    statusIdx: index("note_tags_status_idx").on(table.status),
    uniqueNoteTag: uniqueIndex("note_tags_note_tag_unique_idx").on(table.noteId, table.tagId),
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

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    position: integer("position").notNull(),
    role: text("role").notNull(),
    message: jsonb("message").notNull(),
    textContent: text("text_content").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    conversationIdx: index("conversation_messages_conversation_idx").on(table.conversationId),
    conversationPositionIdx: uniqueIndex("conversation_messages_conversation_position_idx").on(
      table.conversationId,
      table.position,
    ),
  }),
);

// ============================================
// 统一知识库 (Knowledge Chunks)
// ============================================

export const knowledgeChunks = pgTable(
  "knowledge_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    sourceType: text("source_type").notNull().default("note"),
    sourceId: uuid("source_id").notNull(),

    content: text("content").notNull(),
    embedding: embeddingVector("embedding"),
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

export const noteChunks = knowledgeChunks;

// ============================================
// 课程系统
// ============================================

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, {
        onDelete: "cascade",
      })
      .notNull(),

    title: text("title").notNull(),
    description: text("description"),
    difficulty: text("difficulty").notNull().default("intermediate"),
    estimatedMinutes: integer("estimated_minutes"),

    outlineData: jsonb("outline_data").notNull(),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("courses_user_id_idx").on(table.userId),
  }),
);

export const courseSections = pgTable(
  "course_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    outlineNodeId: text("outline_node_id").notNull(),
    title: text("title").notNull(),
    contentMarkdown: text("content_markdown"),
    plainText: text("plain_text"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    courseIdIdx: index("course_sections_course_id_idx").on(table.courseId),
    outlineNodeIdIdx: uniqueIndex("course_sections_course_outline_idx").on(
      table.courseId,
      table.outlineNodeId,
    ),
  }),
);

export const courseProgress = pgTable(
  "course_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    currentChapter: integer("current_chapter").notNull().default(0),
    completedChapters: jsonb("completed_chapters").$type<number[]>().notNull().default([]),
    completedSections: jsonb("completed_sections").$type<string[]>().notNull().default([]),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    updatedAt: timestamp("updated_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    courseIdUniqueIdx: uniqueIndex("course_progress_course_id_unique_idx").on(table.courseId),
    userIdIdx: index("course_progress_user_id_idx").on(table.userId),
  }),
);

export const courseSectionAnnotations = pgTable(
  "course_section_annotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseSectionId: uuid("course_section_id")
      .references(() => courseSections.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: text("type").notNull(),
    anchor: jsonb("anchor").notNull(),
    color: text("color"),
    noteContent: text("note_content"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    courseSectionIdIdx: index("course_section_annotations_section_id_idx").on(
      table.courseSectionId,
    ),
    userIdIdx: index("course_section_annotations_user_id_idx").on(table.userId),
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

    requestId: text("request_id"),
    endpoint: text("endpoint").notNull(),
    intent: text("intent"),
    profile: text("profile"),
    workflow: text("workflow"),
    model: text("model").notNull(),
    promptVersion: text("prompt_version"),

    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),

    costCents: integer("cost_cents").notNull().default(0),

    durationMs: integer("duration_ms"),
    success: boolean("success").notNull().default(true),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("ai_usage_user_id_idx").on(table.userId),
    requestIdIdx: index("ai_usage_request_id_idx").on(table.requestId),
    endpointIdx: index("ai_usage_endpoint_idx").on(table.endpoint),
    profileIdx: index("ai_usage_profile_idx").on(table.profile),
    workflowIdx: index("ai_usage_workflow_idx").on(table.workflow),
    createdAtIdx: index("ai_usage_created_at_idx").on(table.createdAt),
  }),
);

// ============================================
// 类型导出
// ============================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type NoteSnapshot = typeof noteSnapshots.$inferSelect;
export type NewNoteSnapshot = typeof noteSnapshots.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type NoteTag = typeof noteTags.$inferSelect;
export type NewNoteTag = typeof noteTags.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type NewConversationMessage = typeof conversationMessages.$inferInsert;

export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type NewKnowledgeChunk = typeof knowledgeChunks.$inferInsert;

export type NoteChunk = KnowledgeChunk;
export type NewNoteChunk = NewKnowledgeChunk;

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
export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type CourseSection = typeof courseSections.$inferSelect;
export type NewCourseSection = typeof courseSections.$inferInsert;
export type CourseProgress = typeof courseProgress.$inferSelect;
export type NewCourseProgress = typeof courseProgress.$inferInsert;
export type CourseSectionAnnotation = typeof courseSectionAnnotations.$inferSelect;
export type NewCourseSectionAnnotation = typeof courseSectionAnnotations.$inferInsert;
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
  courses: many(courses),
  notes: many(notes),
  conversations: many(conversations),
  knowledgeChunks: many(knowledgeChunks),
  userProfiles: many(userProfiles),
  stylePrivacySettings: many(stylePrivacySettings),
  createdPersonas: many(personas),
  personaPreference: many(userPersonaPreferences),
  courseProgress: many(courseProgress),
  courseSectionAnnotations: many(courseSectionAnnotations),
  noteTags: many(noteTags),
}));

export const notesRelations = relations(notes, ({ one, many }) => ({
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
  snapshots: many(noteSnapshots),
  tags: many(noteTags),
}));

export const noteSnapshotsRelations = relations(noteSnapshots, ({ one }) => ({
  note: one(notes, {
    fields: [noteSnapshots.noteId],
    references: [notes.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  noteTags: many(noteTags),
}));

export const noteTagsRelations = relations(noteTags, ({ one }) => ({
  note: one(notes, {
    fields: [noteTags.noteId],
    references: [notes.id],
  }),
  tag: one(tags, {
    fields: [noteTags.tagId],
    references: [tags.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  messages: many(conversationMessages),
}));

export const conversationMessagesRelations = relations(conversationMessages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationMessages.conversationId],
    references: [conversations.id],
  }),
}));

export const knowledgeChunksRelations = relations(knowledgeChunks, ({ one }) => ({
  user: one(users, {
    fields: [knowledgeChunks.userId],
    references: [users.id],
  }),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  user: one(users, {
    fields: [courses.userId],
    references: [users.id],
  }),
  sections: many(courseSections),
  progress: many(courseProgress),
}));

export const courseSectionsRelations = relations(courseSections, ({ one, many }) => ({
  course: one(courses, {
    fields: [courseSections.courseId],
    references: [courses.id],
  }),
  annotations: many(courseSectionAnnotations),
}));

export const courseProgressRelations = relations(courseProgress, ({ one }) => ({
  course: one(courses, {
    fields: [courseProgress.courseId],
    references: [courses.id],
  }),
  user: one(users, {
    fields: [courseProgress.userId],
    references: [users.id],
  }),
}));

export const courseSectionAnnotationsRelations = relations(courseSectionAnnotations, ({ one }) => ({
  courseSection: one(courseSections, {
    fields: [courseSectionAnnotations.courseSectionId],
    references: [courseSections.id],
  }),
  user: one(users, {
    fields: [courseSectionAnnotations.userId],
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
