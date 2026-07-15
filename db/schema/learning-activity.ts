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
import { courses } from "./courses";
import { learningEnrollments } from "./learning";

export type LearningActivityEventType =
  | "course_generated"
  | "course_opened"
  | "course_started"
  | "section_completed"
  | "course_completed";

export interface LearningActivityMetadata {
  chapterIndex?: number;
  sectionIndex?: number;
  completedSectionCount?: number;
  totalSectionCount?: number;
  source?:
    | "course_generation"
    | "course_reader"
    | "publication_reader"
    | "progress_transition"
    | "backfill";
}

export const learningActivityEvents = pgTable(
  "learning_activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    enrollmentId: uuid("enrollment_id").references(() => learningEnrollments.id, {
      onDelete: "cascade",
    }),
    eventType: text("event_type").$type<LearningActivityEventType>().notNull(),
    sectionNodeId: text("section_node_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    metadata: jsonb("metadata").$type<LearningActivityMetadata>().notNull().default({}),
    occurredAt: timestamp("occurred_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    idempotencyKeyUniqueIdx: uniqueIndex("learning_activity_events_idempotency_key_unique_idx").on(
      table.idempotencyKey,
    ),
    userOccurredAtIdx: index("learning_activity_events_user_occurred_at_idx").on(
      table.userId,
      table.occurredAt,
    ),
    courseOccurredAtIdx: index("learning_activity_events_course_occurred_at_idx").on(
      table.courseId,
      table.occurredAt,
    ),
    typeOccurredAtIdx: index("learning_activity_events_type_occurred_at_idx").on(
      table.eventType,
      table.occurredAt,
    ),
    userTypeOccurredAtIdx: index("learning_activity_events_user_type_occurred_at_idx").on(
      table.userId,
      table.eventType,
      table.occurredAt,
    ),
  }),
);

export const learningActivationProjections = pgTable(
  "learning_activation_projections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    generatedAt: timestamp("generated_at"),
    startedAt: timestamp("started_at"),
    firstCompletedAt: timestamp("first_completed_at"),
    continuedAt: timestamp("continued_at"),
    completedAt: timestamp("completed_at"),
    sourceEventCount: integer("source_event_count").notNull().default(0),
    lastEventAt: timestamp("last_event_at").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userCourseUniqueIdx: uniqueIndex("learning_activation_projections_user_course_unique_idx").on(
      table.userId,
      table.courseId,
    ),
    userGeneratedIdx: index("learning_activation_projections_user_generated_idx").on(
      table.userId,
      table.generatedAt,
    ),
    generatedIdx: index("learning_activation_projections_generated_idx").on(table.generatedAt),
  }),
);

export type LearningActivityEvent = typeof learningActivityEvents.$inferSelect;
export type NewLearningActivityEvent = typeof learningActivityEvents.$inferInsert;
export type LearningActivationProjection = typeof learningActivationProjections.$inferSelect;
