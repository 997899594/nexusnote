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

export const aiSkins = pgTable(
  "ai_skins",
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
    slugIdx: index("ai_skins_slug_idx").on(table.slug),
    authorIdIdx: index("ai_skins_author_id_idx").on(table.authorId),
    isEnabledIdx: index("ai_skins_is_enabled_idx").on(table.isEnabled),
  }),
);

export const userSkinPreferences = pgTable(
  "user_skin_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    defaultSkinSlug: text("default_skin_slug").notNull().default("default"),
    lastSwitchedAt: timestamp("last_switched_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("user_skin_preferences_user_id_idx").on(table.userId),
  }),
);

export type AISkinRecord = typeof aiSkins.$inferSelect;
export type NewAISkinRecord = typeof aiSkins.$inferInsert;
export type UserSkinPreferenceRecord = typeof userSkinPreferences.$inferSelect;
export type NewUserSkinPreferenceRecord = typeof userSkinPreferences.$inferInsert;
