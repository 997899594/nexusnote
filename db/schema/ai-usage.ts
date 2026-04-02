import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

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
    provider: text("provider"),
    modelPolicy: text("model_policy"),
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
    providerIdx: index("ai_usage_provider_idx").on(table.provider),
    modelPolicyIdx: index("ai_usage_model_policy_idx").on(table.modelPolicy),
    createdAtIdx: index("ai_usage_created_at_idx").on(table.createdAt),
  }),
);

export type AIUsage = typeof aiUsage.$inferSelect;
export type NewAIUsage = typeof aiUsage.$inferInsert;
