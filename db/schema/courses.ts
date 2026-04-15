import {
  boolean,
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
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("courses_user_id_idx").on(table.userId),
  }),
);

export const courseOutlineVersions = pgTable(
  "course_outline_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    versionHash: text("version_hash").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    targetAudience: text("target_audience"),
    difficulty: text("difficulty").notNull().default("intermediate"),
    learningOutcome: text("learning_outcome"),
    courseSkillIds: jsonb("course_skill_ids").$type<string[]>().notNull().default([]),
    prerequisites: jsonb("prerequisites").$type<string[]>().notNull().default([]),
    isLatest: boolean("is_latest").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    courseLatestIdx: index("course_outline_versions_course_latest_idx").on(
      table.courseId,
      table.isLatest,
    ),
    courseHashUniqueIdx: uniqueIndex("course_outline_versions_course_hash_unique_idx").on(
      table.courseId,
      table.versionHash,
    ),
  }),
);

export const courseOutlineNodes = pgTable(
  "course_outline_nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    outlineVersionId: uuid("outline_version_id")
      .references(() => courseOutlineVersions.id, { onDelete: "cascade" })
      .notNull(),
    nodeType: text("node_type").notNull(),
    nodeKey: text("node_key").notNull(),
    parentNodeKey: text("parent_node_key"),
    chapterIndex: integer("chapter_index").notNull(),
    sectionIndex: integer("section_index"),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    skillIds: jsonb("skill_ids").$type<string[]>().notNull().default([]),
    practiceType: text("practice_type"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    outlineNodeUniqueIdx: uniqueIndex("course_outline_nodes_outline_node_unique_idx").on(
      table.outlineVersionId,
      table.nodeKey,
    ),
    courseVersionIdx: index("course_outline_nodes_course_version_idx").on(
      table.courseId,
      table.outlineVersionId,
    ),
    courseTypeIdx: index("course_outline_nodes_course_type_idx").on(table.courseId, table.nodeType),
  }),
);

export const courseSections = pgTable(
  "course_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    outlineNodeKey: text("outline_node_key").notNull(),
    title: text("title").notNull(),
    contentMarkdown: text("content_markdown"),
    plainText: text("plain_text"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    courseIdIdx: index("course_sections_course_id_idx").on(table.courseId),
    outlineNodeKeyIdx: uniqueIndex("course_sections_course_outline_idx").on(
      table.courseId,
      table.outlineNodeKey,
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

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type CourseOutlineVersion = typeof courseOutlineVersions.$inferSelect;
export type NewCourseOutlineVersion = typeof courseOutlineVersions.$inferInsert;
export type CourseOutlineNode = typeof courseOutlineNodes.$inferSelect;
export type NewCourseOutlineNode = typeof courseOutlineNodes.$inferInsert;
export type CourseSection = typeof courseSections.$inferSelect;
export type NewCourseSection = typeof courseSections.$inferInsert;
export type CourseProgress = typeof courseProgress.$inferSelect;
export type NewCourseProgress = typeof courseProgress.$inferInsert;
export type CourseSectionAnnotation = typeof courseSectionAnnotations.$inferSelect;
export type NewCourseSectionAnnotation = typeof courseSectionAnnotations.$inferInsert;
