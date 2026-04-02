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

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, {
        onDelete: "cascade",
      })
      .notNull(),
    title: text("title").notNull(),
    description: text("description"),
    difficulty: text("difficulty").notNull().default("intermediate"),
    estimatedMinutes: integer("estimated_minutes"),
    outlineData: jsonb("outline_data").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("courses_user_id_idx").on(table.userId),
  }),
);

export const courseSections = pgTable(
  "course_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    outlineNodeId: text("outline_node_id").notNull(),
    title: text("title").notNull(),
    contentMarkdown: text("content_markdown"),
    plainText: text("plain_text"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    courseIdIdx: index("course_sections_course_id_idx").on(table.courseId),
    outlineNodeIdIdx: uniqueIndex("course_sections_course_outline_idx").on(
      table.courseId,
      table.outlineNodeId,
    ),
  }),
);

export const courseProgress = pgTable(
  "course_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    currentChapter: integer("current_chapter").notNull().default(0),
    completedChapters: jsonb("completed_chapters").$type<number[]>().notNull().default([]),
    completedSections: jsonb("completed_sections").$type<string[]>().notNull().default([]),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    updatedAt: timestamp("updated_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    courseIdUniqueIdx: uniqueIndex("course_progress_course_id_unique_idx").on(table.courseId),
    userIdIdx: index("course_progress_user_id_idx").on(table.userId),
  }),
);

export const courseSectionAnnotations = pgTable(
  "course_section_annotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseSectionId: uuid("course_section_id")
      .references(() => courseSections.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: text("type").notNull(),
    anchor: jsonb("anchor").notNull(),
    color: text("color"),
    noteContent: text("note_content"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    courseSectionIdIdx: index("course_section_annotations_section_id_idx").on(
      table.courseSectionId,
    ),
    userIdIdx: index("course_section_annotations_user_id_idx").on(table.userId),
  }),
);

export const courseSkillMappings = pgTable(
  "course_skill_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    skillKey: text("skill_key").notNull(),
    source: text("source").notNull().default("heuristic"),
    confidence: integer("confidence").notNull().default(0),
    metadata: jsonb("metadata").$type<{
      matchedAliases?: string[];
      matchedSignals?: string[];
      inferredFrom?: string[];
      sourceHits?: string[];
      matchScore?: number;
    }>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    courseIdIdx: index("course_skill_mappings_course_id_idx").on(table.courseId),
    skillKeyIdx: index("course_skill_mappings_skill_key_idx").on(table.skillKey),
    uniqueCourseSkillIdx: uniqueIndex("course_skill_mappings_unique_idx").on(
      table.courseId,
      table.skillKey,
    ),
  }),
);

export const courseChapterSkillMappings = pgTable(
  "course_chapter_skill_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    chapterIndex: integer("chapter_index").notNull(),
    skillKey: text("skill_key").notNull(),
    source: text("source").notNull().default("heuristic"),
    confidence: integer("confidence").notNull().default(0),
    metadata: jsonb("metadata").$type<{
      chapterTitle?: string;
      matchedAliases?: string[];
      matchedSignals?: string[];
      inferredFrom?: string[];
      sourceHits?: string[];
      matchScore?: number;
    }>(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    courseIdIdx: index("course_chapter_skill_mappings_course_id_idx").on(
      table.courseId,
      table.chapterIndex,
    ),
    skillKeyIdx: index("course_chapter_skill_mappings_skill_key_idx").on(table.skillKey),
    uniqueCourseChapterSkillIdx: uniqueIndex("course_chapter_skill_mappings_unique_idx").on(
      table.courseId,
      table.chapterIndex,
      table.skillKey,
    ),
  }),
);

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type CourseSection = typeof courseSections.$inferSelect;
export type NewCourseSection = typeof courseSections.$inferInsert;
export type CourseProgress = typeof courseProgress.$inferSelect;
export type NewCourseProgress = typeof courseProgress.$inferInsert;
export type CourseSectionAnnotation = typeof courseSectionAnnotations.$inferSelect;
export type NewCourseSectionAnnotation = typeof courseSectionAnnotations.$inferInsert;
export type CourseSkillMapping = typeof courseSkillMappings.$inferSelect;
export type NewCourseSkillMapping = typeof courseSkillMappings.$inferInsert;
export type CourseChapterSkillMapping = typeof courseChapterSkillMappings.$inferSelect;
export type NewCourseChapterSkillMapping = typeof courseChapterSkillMappings.$inferInsert;
