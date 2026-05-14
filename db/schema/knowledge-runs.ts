import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { courses } from "./courses";

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

export type KnowledgeGenerationRun = typeof knowledgeGenerationRuns.$inferSelect;
export type NewKnowledgeGenerationRun = typeof knowledgeGenerationRuns.$inferInsert;
