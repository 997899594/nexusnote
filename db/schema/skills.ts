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

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    category: text("category"),
    domain: text("domain"),
    description: text("description"),
    icon: text("icon"),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    categoryIdx: index("skills_category_idx").on(table.category),
  }),
);

export const skillRelationships = pgTable(
  "skill_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceSkillId: uuid("source_skill_id")
      .references(() => skills.id, { onDelete: "cascade" })
      .notNull(),
    targetSkillId: uuid("target_skill_id")
      .references(() => skills.id, { onDelete: "cascade" })
      .notNull(),
    relationshipType: text("relationship_type").notNull(),
    strength: integer("strength").notNull().default(50),
    confidence: integer("confidence").notNull().default(50),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    sourceIdx: index("skill_relationships_source_idx").on(table.sourceSkillId),
    targetIdx: index("skill_relationships_target_idx").on(table.targetSkillId),
    uniqueRelation: index("skill_relationships_unique_idx").on(
      table.sourceSkillId,
      table.targetSkillId,
      table.relationshipType,
    ),
  }),
);

export const userSkillMastery = pgTable(
  "user_skill_mastery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    skillId: uuid("skill_id")
      .references(() => skills.id, { onDelete: "cascade" })
      .notNull(),
    level: integer("level").notNull().default(0),
    experience: integer("experience").notNull().default(0),
    evidence: jsonb("evidence").$type<string[]>().notNull().default([]),
    confidence: integer("confidence").notNull().default(0),
    unlockedAt: timestamp("unlocked_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("user_skill_mastery_user_idx").on(table.userId),
    skillIdx: index("user_skill_mastery_skill_idx").on(table.skillId),
    uniqueUserSkill: index("user_skill_mastery_unique_idx").on(table.userId, table.skillId),
  }),
);

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
export type SkillRelationship = typeof skillRelationships.$inferSelect;
export type NewSkillRelationship = typeof skillRelationships.$inferInsert;
export type UserSkillMastery = typeof userSkillMastery.$inferSelect;
export type NewUserSkillMastery = typeof userSkillMastery.$inferInsert;
