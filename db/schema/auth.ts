import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { EMAValue } from "@/types/profile";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
    aiPreferences: jsonb("ai_preferences"),
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type StylePrivacySettings = typeof stylePrivacySettings.$inferSelect;
export type NewStylePrivacySettings = typeof stylePrivacySettings.$inferInsert;
