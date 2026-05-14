import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { conversations } from "./conversations";

export const researchRuns = pgTable(
  "research_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: uuid("session_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    jobType: text("job_type").notNull(),
    status: text("status").notNull(),
    routeProfile: text("route_profile"),
    workerTransport: text("worker_transport").notNull().default("local"),
    userPrompt: text("user_prompt").notNull(),
    inputHash: text("input_hash").notNull(),
    queueJobId: text("queue_job_id"),
    retryOfRunId: uuid("retry_of_run_id"),
    progressJson: jsonb("progress_json").$type<Record<string, unknown>>(),
    planJson: jsonb("plan_json").$type<Record<string, unknown>>(),
    reportJson: jsonb("report_json").$type<Record<string, unknown>>(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    cancelRequestedAt: timestamp("cancel_requested_at"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userStatusIdx: index("research_runs_user_status_idx").on(table.userId, table.status),
    sessionCreatedIdx: index("research_runs_session_created_idx").on(
      table.sessionId,
      table.createdAt,
    ),
    retryOfIdx: index("research_runs_retry_of_idx").on(table.retryOfRunId),
    queueJobIdUniqueIdx: uniqueIndex("research_runs_queue_job_id_unique_idx").on(table.queueJobId),
  }),
);

export const researchRunTasks = pgTable(
  "research_run_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .references(() => researchRuns.id, { onDelete: "cascade" })
      .notNull(),
    taskKey: text("task_key").notNull(),
    ordinal: integer("ordinal").notNull(),
    title: text("title").notNull(),
    query: text("query").notNull(),
    focus: text("focus").notNull(),
    status: text("status").notNull(),
    summary: text("summary"),
    findings: jsonb("findings").$type<string[]>().notNull().default([]),
    evidenceGaps: jsonb("evidence_gaps").$type<string[]>().notNull().default([]),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    runOrdinalUniqueIdx: uniqueIndex("research_run_tasks_run_ordinal_unique_idx").on(
      table.runId,
      table.ordinal,
    ),
    runTaskKeyUniqueIdx: uniqueIndex("research_run_tasks_run_task_key_unique_idx").on(
      table.runId,
      table.taskKey,
    ),
    runStatusIdx: index("research_run_tasks_run_status_idx").on(table.runId, table.status),
  }),
);

export const researchRunSources = pgTable(
  "research_run_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .references(() => researchRuns.id, { onDelete: "cascade" })
      .notNull(),
    taskId: uuid("task_id").references(() => researchRunTasks.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    domain: text("domain").notNull(),
    snippet: text("snippet").notNull(),
    rank: integer("rank").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    runTaskUrlUniqueIdx: uniqueIndex("research_run_sources_run_task_url_unique_idx").on(
      table.runId,
      table.taskId,
      table.url,
    ),
    runIdx: index("research_run_sources_run_idx").on(table.runId),
    taskIdx: index("research_run_sources_task_idx").on(table.taskId),
  }),
);

export type ResearchRunRecord = typeof researchRuns.$inferSelect;
export type NewResearchRunRecord = typeof researchRuns.$inferInsert;
export type ResearchRunTaskRecord = typeof researchRunTasks.$inferSelect;
export type NewResearchRunTaskRecord = typeof researchRunTasks.$inferInsert;
export type ResearchRunSourceRecord = typeof researchRunSources.$inferSelect;
export type NewResearchRunSourceRecord = typeof researchRunSources.$inferInsert;
