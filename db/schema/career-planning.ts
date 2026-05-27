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

export const careerPlanningSessions = pgTable(
  "career_planning_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("active"),
    selectedRouteKey: text("selected_route_key"),
    sourceSnapshotJson: jsonb("source_snapshot_json").$type<Record<string, unknown>>(),
    signalsJson: jsonb("signals_json").$type<Record<string, unknown>[]>().notNull().default([]),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userStatusIdx: index("career_planning_sessions_user_status_idx").on(table.userId, table.status),
    conversationIdx: index("career_planning_sessions_conversation_idx").on(table.conversationId),
  }),
);

export const careerPlanRevisions = pgTable(
  "career_plan_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .references(() => careerPlanningSessions.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    revisionIndex: integer("revision_index").notNull(),
    source: text("source").notNull(),
    selectedRouteKey: text("selected_route_key"),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    sourceSnapshotJson: jsonb("source_snapshot_json").$type<Record<string, unknown>>(),
    signalsJson: jsonb("signals_json").$type<Record<string, unknown>[]>().notNull().default([]),
    routesJson: jsonb("routes_json").$type<Record<string, unknown>[]>().notNull().default([]),
    constraintsJson: jsonb("constraints_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    mapJson: jsonb("map_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sessionRevisionUniqueIdx: uniqueIndex("career_plan_revisions_session_revision_unique_idx").on(
      table.sessionId,
      table.revisionIndex,
    ),
    userCreatedIdx: index("career_plan_revisions_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    sessionIdx: index("career_plan_revisions_session_idx").on(table.sessionId),
  }),
);

export type CareerPlanningSession = typeof careerPlanningSessions.$inferSelect;
export type NewCareerPlanningSession = typeof careerPlanningSessions.$inferInsert;
export type CareerPlanRevision = typeof careerPlanRevisions.$inferSelect;
export type NewCareerPlanRevision = typeof careerPlanRevisions.$inferInsert;
