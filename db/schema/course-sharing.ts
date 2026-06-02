import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { ResearchSourceType } from "@/lib/ai/research/source-types";
import { users } from "./auth";
import { courseOutlineVersions, courses } from "./courses";

export type CoursePublicationStatus = "published" | "revoked";
export type CoursePublicAnnotationStatus = "visible" | "hidden";

export interface CoursePublicationSnapshotContent {
  course: {
    id: string;
    title: string;
    description: string | null;
    difficulty: string | null;
    estimatedMinutes: number | null;
    learningOutcome: string | null;
    targetAudience: string | null;
  };
  outline: {
    chapters: Array<{
      title: string;
      description: string;
      sections: Array<{
        nodeId: string;
        title: string;
        description: string;
      }>;
    }>;
  };
  sections: Array<{
    id: string;
    nodeId: string;
    title: string | null;
    content: string | null;
  }>;
  citations: Array<{
    id: string;
    title: string;
    url: string;
    domain: string;
    snippet?: string;
    sourceType?: ResearchSourceType;
    publishedAt?: string;
  }>;
}

export interface CoursePublicAnnotationAnchor {
  textContent: string;
  startOffset: number;
  endOffset: number;
}

export const coursePublications = pgTable(
  "course_publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceCourseId: uuid("source_course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    ownerUserId: uuid("owner_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    currentSnapshotId: uuid("current_snapshot_id"),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").$type<CoursePublicationStatus>().notNull().default("published"),
    allowAnnotations: boolean("allow_annotations").notNull().default(true),
    publishedAt: timestamp("published_at").defaultNow(),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    sourceCourseUniqueIdx: uniqueIndex("course_publications_source_course_unique_idx").on(
      table.sourceCourseId,
    ),
    slugUniqueIdx: uniqueIndex("course_publications_slug_unique_idx").on(table.slug),
    ownerStatusIdx: index("course_publications_owner_status_idx").on(
      table.ownerUserId,
      table.status,
    ),
  }),
);

export const coursePublicationSnapshots = pgTable(
  "course_publication_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicationId: uuid("publication_id")
      .references(() => coursePublications.id, { onDelete: "cascade" })
      .notNull(),
    sourceCourseId: uuid("source_course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    sourceOutlineVersionId: uuid("source_outline_version_id")
      .references(() => courseOutlineVersions.id, { onDelete: "restrict" })
      .notNull(),
    snapshotHash: text("snapshot_hash").notNull(),
    contentJson: jsonb("content_json").$type<CoursePublicationSnapshotContent>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    publicationCreatedIdx: index("course_publication_snapshots_publication_created_idx").on(
      table.publicationId,
      table.createdAt,
    ),
    publicationHashUniqueIdx: uniqueIndex(
      "course_publication_snapshots_publication_hash_unique_idx",
    ).on(table.publicationId, table.snapshotHash),
  }),
);

export const coursePublicAnnotations = pgTable(
  "course_public_annotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicationId: uuid("publication_id")
      .references(() => coursePublications.id, { onDelete: "cascade" })
      .notNull(),
    snapshotId: uuid("snapshot_id")
      .references(() => coursePublicationSnapshots.id, { onDelete: "cascade" })
      .notNull(),
    sectionKey: text("section_key").notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    anchor: jsonb("anchor").$type<CoursePublicAnnotationAnchor>().notNull(),
    quotedText: text("quoted_text").notNull(),
    body: text("body").notNull(),
    status: text("status").$type<CoursePublicAnnotationStatus>().notNull().default("visible"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    publicationSectionIdx: index("course_public_annotations_publication_section_idx").on(
      table.publicationId,
      table.sectionKey,
      table.status,
    ),
    userIdx: index("course_public_annotations_user_idx").on(table.userId),
  }),
);

export const coursePublicationSaves = pgTable(
  "course_publication_saves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicationId: uuid("publication_id")
      .references(() => coursePublications.id, { onDelete: "cascade" })
      .notNull(),
    snapshotId: uuid("snapshot_id")
      .references(() => coursePublicationSnapshots.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    savedCourseId: uuid("saved_course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userPublicationUniqueIdx: uniqueIndex(
      "course_publication_saves_user_publication_unique_idx",
    ).on(table.userId, table.publicationId),
    publicationIdx: index("course_publication_saves_publication_idx").on(table.publicationId),
    savedCourseIdx: index("course_publication_saves_saved_course_idx").on(table.savedCourseId),
  }),
);

export type CoursePublication = typeof coursePublications.$inferSelect;
export type NewCoursePublication = typeof coursePublications.$inferInsert;
export type CoursePublicationSnapshot = typeof coursePublicationSnapshots.$inferSelect;
export type NewCoursePublicationSnapshot = typeof coursePublicationSnapshots.$inferInsert;
export type CoursePublicAnnotation = typeof coursePublicAnnotations.$inferSelect;
export type NewCoursePublicAnnotation = typeof coursePublicAnnotations.$inferInsert;
export type CoursePublicationSave = typeof coursePublicationSaves.$inferSelect;
export type NewCoursePublicationSave = typeof coursePublicationSaves.$inferInsert;
