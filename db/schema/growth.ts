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
import { knowledgeEvidence } from "./knowledge";

export const knowledgeGenerationRuns = pgTable(
  "knowledge_generation_runs",
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
    idempotencyKeyUniqueIdx: uniqueIndex("knowledge_generation_runs_idempotency_key_unique_idx").on(
      table.idempotencyKey,
    ),
    userKindIdx: index("knowledge_generation_runs_user_kind_idx").on(table.userId, table.kind),
    courseIdx: index("knowledge_generation_runs_course_idx").on(table.courseId),
  }),
);

export const userSkillNodes = pgTable(
  "user_skill_nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    canonicalLabel: text("canonical_label").notNull(),
    summary: text("summary"),
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
    userIdx: index("user_skill_nodes_user_idx").on(table.userId),
    userCanonicalIdx: index("user_skill_nodes_user_canonical_idx").on(
      table.userId,
      table.canonicalLabel,
    ),
  }),
);

export const userSkillEdges = pgTable(
  "user_skill_edges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    fromNodeId: uuid("from_node_id")
      .references(() => userSkillNodes.id, { onDelete: "cascade" })
      .notNull(),
    toNodeId: uuid("to_node_id")
      .references(() => userSkillNodes.id, { onDelete: "cascade" })
      .notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    sourceMergeRunId: uuid("source_merge_run_id").references(() => knowledgeGenerationRuns.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("user_skill_edges_user_idx").on(table.userId),
    uniqueEdgeIdx: uniqueIndex("user_skill_edges_unique_idx").on(
      table.userId,
      table.fromNodeId,
      table.toNodeId,
    ),
  }),
);

export const userSkillNodeEvidence = pgTable(
  "user_skill_node_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    nodeId: uuid("node_id")
      .references(() => userSkillNodes.id, { onDelete: "cascade" })
      .notNull(),
    knowledgeEvidenceId: uuid("knowledge_evidence_id")
      .references(() => knowledgeEvidence.id, { onDelete: "cascade" })
      .notNull(),
    mergeRunId: uuid("merge_run_id").references(() => knowledgeGenerationRuns.id, {
      onDelete: "cascade",
    }),
    weight: numeric("weight", { precision: 5, scale: 3 }).notNull().default("1.000"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueNodeEvidenceIdx: uniqueIndex("user_skill_node_evidence_unique_idx").on(
      table.nodeId,
      table.knowledgeEvidenceId,
    ),
    userNodeIdx: index("user_skill_node_evidence_user_node_idx").on(table.userId, table.nodeId),
  }),
);

export const userCareerTreePreferences = pgTable(
  "user_career_tree_preferences",
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
    selectedDirectionIdx: index("user_career_tree_preferences_selected_direction_idx").on(
      table.selectedDirectionKey,
    ),
  }),
);

export const userGrowthState = pgTable("user_growth_state", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  graphVersion: integer("graph_version").notNull().default(0),
  lastMergeRunId: uuid("last_merge_run_id").references(() => knowledgeGenerationRuns.id, {
    onDelete: "set null",
  }),
  mergeLockedAt: timestamp("merge_locked_at"),
  composeLockedAt: timestamp("compose_locked_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userCareerTreeSnapshots = pgTable(
  "user_career_tree_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    composeRunId: uuid("compose_run_id").references(() => knowledgeGenerationRuns.id, {
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
    userLatestIdx: index("user_career_tree_snapshots_user_latest_idx").on(
      table.userId,
      table.isLatest,
    ),
    userCreatedIdx: index("user_career_tree_snapshots_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  }),
);

export const userFocusSnapshots = pgTable(
  "user_focus_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    treeSnapshotId: uuid("tree_snapshot_id").references(() => userCareerTreeSnapshots.id, {
      onDelete: "set null",
    }),
    directionKey: text("direction_key"),
    nodeId: text("node_id"),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    progress: integer("progress").notNull().default(0),
    state: text("state").notNull(),
    payload: jsonb("payload").notNull(),
    isLatest: boolean("is_latest").notNull().default(false),
    generatedAt: timestamp("generated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userLatestIdx: index("user_focus_snapshots_user_latest_idx").on(table.userId, table.isLatest),
  }),
);

export const userProfileSnapshots = pgTable(
  "user_profile_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    treeSnapshotId: uuid("tree_snapshot_id").references(() => userCareerTreeSnapshots.id, {
      onDelete: "set null",
    }),
    focusSnapshotId: uuid("focus_snapshot_id").references(() => userFocusSnapshots.id, {
      onDelete: "set null",
    }),
    payload: jsonb("payload").notNull(),
    isLatest: boolean("is_latest").notNull().default(false),
    generatedAt: timestamp("generated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userLatestIdx: index("user_profile_snapshots_user_latest_idx").on(table.userId, table.isLatest),
  }),
);

export type KnowledgeGenerationRun = typeof knowledgeGenerationRuns.$inferSelect;
export type NewKnowledgeGenerationRun = typeof knowledgeGenerationRuns.$inferInsert;
export type UserCareerTreePreference = typeof userCareerTreePreferences.$inferSelect;
export type NewUserCareerTreePreference = typeof userCareerTreePreferences.$inferInsert;
export type UserGrowthState = typeof userGrowthState.$inferSelect;
export type NewUserGrowthState = typeof userGrowthState.$inferInsert;
export type UserCareerTreeSnapshotRecord = typeof userCareerTreeSnapshots.$inferSelect;
export type NewUserCareerTreeSnapshotRecord = typeof userCareerTreeSnapshots.$inferInsert;
export type UserFocusSnapshot = typeof userFocusSnapshots.$inferSelect;
export type NewUserFocusSnapshot = typeof userFocusSnapshots.$inferInsert;
export type UserProfileSnapshot = typeof userProfileSnapshots.$inferSelect;
export type NewUserProfileSnapshot = typeof userProfileSnapshots.$inferInsert;
