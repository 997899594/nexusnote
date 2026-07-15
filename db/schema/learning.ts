import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { coursePublicationSnapshots, coursePublications } from "./course-sharing";
import { courseOutlineVersions, courses } from "./courses";

export type LearningSourceType = "course_revision" | "publication_snapshot";

export const learningEnrollments = pgTable(
  "learning_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    sourceType: text("source_type").$type<LearningSourceType>().notNull(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    outlineVersionId: uuid("outline_version_id").references(() => courseOutlineVersions.id, {
      onDelete: "cascade",
    }),
    publicationId: uuid("publication_id").references(() => coursePublications.id, {
      onDelete: "cascade",
    }),
    snapshotId: uuid("snapshot_id").references(() => coursePublicationSnapshots.id, {
      onDelete: "cascade",
    }),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    sourceShapeCheck: check(
      "learning_enrollments_source_shape_check",
      sql`(
        (${table.sourceType} = 'course_revision' and ${table.outlineVersionId} is not null and ${table.publicationId} is null and ${table.snapshotId} is null)
        or
        (${table.sourceType} = 'publication_snapshot' and ${table.outlineVersionId} is null and ${table.publicationId} is not null and ${table.snapshotId} is not null)
      )`,
    ),
    userRevisionUniqueIdx: uniqueIndex("learning_enrollments_user_revision_unique_idx").on(
      table.userId,
      table.outlineVersionId,
    ),
    userSnapshotUniqueIdx: uniqueIndex("learning_enrollments_user_snapshot_unique_idx").on(
      table.userId,
      table.snapshotId,
    ),
    userUpdatedIdx: index("learning_enrollments_user_updated_idx").on(
      table.userId,
      table.updatedAt,
    ),
    courseIdx: index("learning_enrollments_course_idx").on(table.courseId),
    publicationIdx: index("learning_enrollments_publication_idx").on(table.publicationId),
  }),
);

export const learningSectionCompletions = pgTable(
  "learning_section_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .references(() => learningEnrollments.id, { onDelete: "cascade" })
      .notNull(),
    sectionId: uuid("section_id").notNull(),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (table) => ({
    enrollmentSectionUniqueIdx: uniqueIndex(
      "learning_section_completions_enrollment_section_unique_idx",
    ).on(table.enrollmentId, table.sectionId),
    enrollmentCompletedIdx: index("learning_section_completions_enrollment_completed_idx").on(
      table.enrollmentId,
      table.completedAt,
    ),
  }),
);

export interface DomainOutboxPayload {
  [key: string]: unknown;
}

export const domainOutboxEvents = pgTable(
  "domain_outbox_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topic: text("topic").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    payload: jsonb("payload").$type<DomainOutboxPayload>().notNull(),
    availableAt: timestamp("available_at").notNull().defaultNow(),
    processedAt: timestamp("processed_at"),
    deadLetteredAt: timestamp("dead_lettered_at"),
    lastAttemptAt: timestamp("last_attempt_at"),
    attemptCount: integer("attempt_count").notNull().default(0),
    replayCount: integer("replay_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    dispatchIdx: index("domain_outbox_events_dispatch_idx").on(
      table.processedAt,
      table.deadLetteredAt,
      table.availableAt,
    ),
    aggregateIdx: index("domain_outbox_events_aggregate_idx").on(
      table.aggregateType,
      table.aggregateId,
    ),
  }),
);

export const appSchemaReleases = pgTable("app_schema_releases", {
  version: text("version").primaryKey(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  appliedAt: timestamp("applied_at").notNull().defaultNow(),
});

export const runtimeHeartbeats = pgTable(
  "runtime_worker_heartbeats",
  {
    runtimeName: text("runtime_name").notNull(),
    workerName: text("worker_name").notNull(),
    instanceId: text("instance_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.runtimeName, table.workerName, table.instanceId] }),
    freshnessIdx: index("runtime_heartbeats_freshness_idx").on(
      table.runtimeName,
      table.workerName,
      table.lastSeenAt,
    ),
  }),
);

export type LearningEnrollment = typeof learningEnrollments.$inferSelect;
export type NewLearningEnrollment = typeof learningEnrollments.$inferInsert;
export type LearningSectionCompletion = typeof learningSectionCompletions.$inferSelect;
export type DomainOutboxEvent = typeof domainOutboxEvents.$inferSelect;
