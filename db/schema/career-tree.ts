import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { courses } from "./courses";

export const careerGenerationRuns = pgTable(
  "career_generation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    inputHash: text("input_hash").notNull(),
    outputJson: jsonb("output_json"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    idempotencyKeyUniqueIdx: uniqueIndex("career_generation_runs_idempotency_key_unique_idx").on(
      table.idempotencyKey,
    ),
    userKindIdx: index("career_generation_runs_user_kind_idx").on(table.userId, table.kind),
    courseIdx: index("career_generation_runs_course_idx").on(table.courseId),
  }),
);

export const careerCourseSkillEvidence = pgTable(
  "career_course_skill_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    extractRunId: uuid("extract_run_id")
      .references(() => careerGenerationRuns.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    kind: text("kind").notNull(),
    summary: text("summary").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    chapterRefs: jsonb("chapter_refs").$type<string[]>().notNull().default([]),
    prerequisiteHints: jsonb("prerequisite_hints").$type<string[]>().notNull().default([]),
    relatedHints: jsonb("related_hints").$type<string[]>().notNull().default([]),
    evidenceSnippets: jsonb("evidence_snippets").$type<string[]>().notNull().default([]),
    sourceOutlineHash: text("source_outline_hash").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userCourseIdx: index("career_course_skill_evidence_user_course_idx").on(
      table.userId,
      table.courseId,
    ),
    extractRunIdx: index("career_course_skill_evidence_extract_run_idx").on(table.extractRunId),
    sourceOutlineIdx: index("career_course_skill_evidence_source_outline_idx").on(
      table.userId,
      table.courseId,
      table.sourceOutlineHash,
    ),
  }),
);

export const careerCourseChapterEvidence = pgTable(
  "career_course_chapter_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    chapterKey: text("chapter_key").notNull(),
    chapterIndex: integer("chapter_index").notNull(),
    chapterTitle: text("chapter_title").notNull(),
    skillEvidenceIds: uuid("skill_evidence_ids")
      .array()
      .$type<string[]>()
      .notNull()
      .default(sql`ARRAY[]::uuid[]`),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userCourseChapterIdx: uniqueIndex("career_course_chapter_evidence_unique_idx").on(
      table.userId,
      table.courseId,
      table.chapterKey,
    ),
    userCourseIdx: index("career_course_chapter_evidence_user_course_idx").on(
      table.userId,
      table.courseId,
    ),
  }),
);

export const careerUserSkillNodes = pgTable(
  "career_user_skill_nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    canonicalLabel: text("canonical_label").notNull(),
    displayHint: text("display_hint"),
    summary: text("summary"),
    kind: text("kind").notNull(),
    state: text("state").notNull(),
    progress: integer("progress").notNull().default(0),
    masteryScore: integer("mastery_score").notNull().default(0),
    evidenceScore: integer("evidence_score").notNull().default(0),
    courseCount: integer("course_count").notNull().default(0),
    chapterCount: integer("chapter_count").notNull().default(0),
    lastMergedAt: timestamp("last_merged_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("career_user_skill_nodes_user_idx").on(table.userId),
    userCanonicalIdx: index("career_user_skill_nodes_user_canonical_idx").on(
      table.userId,
      table.canonicalLabel,
    ),
  }),
);

export const careerUserSkillEdges = pgTable(
  "career_user_skill_edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    fromNodeId: uuid("from_node_id")
      .references(() => careerUserSkillNodes.id, { onDelete: "cascade" })
      .notNull(),
    toNodeId: uuid("to_node_id")
      .references(() => careerUserSkillNodes.id, { onDelete: "cascade" })
      .notNull(),
    edgeType: text("edge_type").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    sourceMergeRunId: uuid("source_merge_run_id").references(() => careerGenerationRuns.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("career_user_skill_edges_user_idx").on(table.userId),
    uniqueEdgeIdx: uniqueIndex("career_user_skill_edges_unique_idx").on(
      table.userId,
      table.fromNodeId,
      table.toNodeId,
      table.edgeType,
    ),
  }),
);

export const careerUserSkillNodeEvidence = pgTable(
  "career_user_skill_node_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    nodeId: uuid("node_id")
      .references(() => careerUserSkillNodes.id, { onDelete: "cascade" })
      .notNull(),
    courseSkillEvidenceId: uuid("course_skill_evidence_id")
      .references(() => careerCourseSkillEvidence.id, { onDelete: "cascade" })
      .notNull(),
    mergeRunId: uuid("merge_run_id").references(() => careerGenerationRuns.id, {
      onDelete: "cascade",
    }),
    weight: numeric("weight", { precision: 5, scale: 3 }).notNull().default("1.000"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueNodeEvidenceIdx: uniqueIndex("career_user_skill_node_evidence_unique_idx").on(
      table.nodeId,
      table.courseSkillEvidenceId,
    ),
    userNodeIdx: index("career_user_skill_node_evidence_user_node_idx").on(
      table.userId,
      table.nodeId,
    ),
    evidenceIdx: index("career_user_skill_node_evidence_evidence_idx").on(
      table.courseSkillEvidenceId,
    ),
  }),
);

export const careerUserTreePreferences = pgTable(
  "career_user_tree_preferences",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    selectedDirectionKey: text("selected_direction_key"),
    selectionCount: integer("selection_count").notNull().default(0),
    preferenceVersion: integer("preference_version").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    selectedDirectionIdx: index("career_user_tree_preferences_selected_direction_idx").on(
      table.selectedDirectionKey,
    ),
  }),
);

export const careerUserGraphState = pgTable("career_user_graph_state", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  graphVersion: integer("graph_version").notNull().default(0),
  lastMergeRunId: uuid("last_merge_run_id").references(() => careerGenerationRuns.id, {
    onDelete: "set null",
  }),
  mergeLockedAt: timestamp("merge_locked_at"),
  composeLockedAt: timestamp("compose_locked_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const careerUserTreeSnapshots = pgTable(
  "career_user_tree_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    composeRunId: uuid("compose_run_id").references(() => careerGenerationRuns.id, {
      onDelete: "set null",
    }),
    schemaVersion: integer("schema_version").notNull(),
    status: text("status").notNull(),
    recommendedDirectionKey: text("recommended_direction_key"),
    selectedDirectionKey: text("selected_direction_key"),
    graphVersion: integer("graph_version").notNull(),
    preferenceVersion: integer("preference_version").notNull(),
    payload: jsonb("payload").notNull(),
    isLatest: boolean("is_latest").notNull().default(false),
    generatedAt: timestamp("generated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userLatestIdx: index("career_user_tree_snapshots_user_latest_idx").on(
      table.userId,
      table.isLatest,
    ),
    userCreatedIdx: index("career_user_tree_snapshots_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  }),
);

export type CareerGenerationRun = typeof careerGenerationRuns.$inferSelect;
export type NewCareerGenerationRun = typeof careerGenerationRuns.$inferInsert;
export type CareerCourseSkillEvidence = typeof careerCourseSkillEvidence.$inferSelect;
export type NewCareerCourseSkillEvidence = typeof careerCourseSkillEvidence.$inferInsert;
export type CareerCourseChapterEvidence = typeof careerCourseChapterEvidence.$inferSelect;
export type NewCareerCourseChapterEvidence = typeof careerCourseChapterEvidence.$inferInsert;
export type CareerUserSkillNode = typeof careerUserSkillNodes.$inferSelect;
export type NewCareerUserSkillNode = typeof careerUserSkillNodes.$inferInsert;
export type CareerUserSkillEdge = typeof careerUserSkillEdges.$inferSelect;
export type NewCareerUserSkillEdge = typeof careerUserSkillEdges.$inferInsert;
export type CareerUserSkillNodeEvidence = typeof careerUserSkillNodeEvidence.$inferSelect;
export type NewCareerUserSkillNodeEvidence = typeof careerUserSkillNodeEvidence.$inferInsert;
export type CareerUserTreePreference = typeof careerUserTreePreferences.$inferSelect;
export type NewCareerUserTreePreference = typeof careerUserTreePreferences.$inferInsert;
export type CareerUserGraphState = typeof careerUserGraphState.$inferSelect;
export type NewCareerUserGraphState = typeof careerUserGraphState.$inferInsert;
export type CareerUserTreeSnapshotRecord = typeof careerUserTreeSnapshots.$inferSelect;
export type NewCareerUserTreeSnapshotRecord = typeof careerUserTreeSnapshots.$inferInsert;
