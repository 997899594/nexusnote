import { createHash, randomBytes } from "node:crypto";
import {
  and,
  coursePublicationLikes,
  coursePublicationSnapshots,
  coursePublications,
  coursePublicationUrges,
  courseSections,
  courses,
  db,
  eq,
  sql,
} from "@/db";
import type {
  CoursePublication,
  CoursePublicationSnapshotContent,
} from "@/db/schema/course-sharing";
import { getOwnedCourseWithOutline } from "@/lib/learning/course-repository";
import { buildSectionOutlineNodeKey } from "@/lib/learning/outline-node-key";
import { stableStringify } from "@/lib/utils/stable-data";

export type CoursePublicationWriteExecutor = Pick<
  typeof db,
  "insert" | "query" | "select" | "update"
>;

export interface CoursePublicationRefreshResult {
  publicationId: string;
  snapshotId: string;
  slug: string;
  status: "published";
}

export interface CoursePublicationEngagement {
  likesCount: number;
  urgesCount: number;
  userLiked: boolean;
  userUrged: boolean;
}

function createPublicationSlug(): string {
  return randomBytes(6).toString("base64url");
}

function computeSnapshotHash(content: CoursePublicationSnapshotContent): string {
  return createHash("sha256").update(stableStringify(content)).digest("hex");
}

function getPublicDescription(
  course: Awaited<ReturnType<typeof getOwnedCourseWithOutline>>,
): string | null {
  if (!course) {
    return null;
  }

  return course.description ?? course.outline.description ?? null;
}

async function loadSectionRows(courseId: string, executor: CoursePublicationWriteExecutor = db) {
  return executor
    .select({
      id: courseSections.id,
      title: courseSections.title,
      content: courseSections.contentMarkdown,
      outlineNodeKey: courseSections.outlineNodeKey,
    })
    .from(courseSections)
    .where(eq(courseSections.courseId, courseId));
}

async function buildPublicationSnapshotContent(
  userId: string,
  courseId: string,
  executor: CoursePublicationWriteExecutor = db,
): Promise<{
  sourceOutlineVersionId: string;
  content: CoursePublicationSnapshotContent;
}> {
  const course = await getOwnedCourseWithOutline(courseId, userId, executor);
  if (!course) {
    throw new Error("COURSE_NOT_FOUND");
  }

  const sectionRows = await loadSectionRows(courseId, executor);
  const sectionsByNodeId = new Map(sectionRows.map((section) => [section.outlineNodeKey, section]));

  return {
    sourceOutlineVersionId: course.outlineVersionId,
    content: {
      course: {
        id: course.id,
        title: course.title,
        description: getPublicDescription(course),
        difficulty: course.difficulty ?? course.outline.difficulty ?? null,
        estimatedMinutes: course.estimatedMinutes ?? null,
        learningOutcome: course.outline.learningOutcome ?? null,
        targetAudience: course.outline.targetAudience ?? null,
      },
      outline: {
        chapters: course.outline.chapters.map((chapter, chapterIndex) => ({
          title: chapter.title,
          description: chapter.description ?? "",
          sections: chapter.sections.map((section, sectionIndex) => ({
            nodeId: buildSectionOutlineNodeKey(chapterIndex, sectionIndex),
            title: section.title,
            description: section.description ?? "",
          })),
        })),
      },
      sections: course.outline.chapters.flatMap((chapter, chapterIndex) =>
        chapter.sections.map((section, sectionIndex) => {
          const nodeId = buildSectionOutlineNodeKey(chapterIndex, sectionIndex);
          const persisted = sectionsByNodeId.get(nodeId);

          return {
            id: persisted?.id ?? nodeId,
            nodeId,
            title: persisted?.title ?? section.title,
            content: persisted?.content ?? null,
          };
        }),
      ),
      citations: (course.outline.researchCitations ?? []).map((citation) => ({
        id: citation.id,
        title: citation.title,
        url: citation.url,
        domain: citation.domain,
        snippet: citation.snippet,
        sourceType: citation.sourceType,
        publishedAt: citation.publishedAt,
      })),
    },
  };
}

async function advanceCoursePublicationSnapshot(params: {
  courseId: string;
  userId: string;
  publication: CoursePublication;
  executor: CoursePublicationWriteExecutor;
  publish: boolean;
}): Promise<CoursePublicationRefreshResult> {
  const { sourceOutlineVersionId, content } = await buildPublicationSnapshotContent(
    params.userId,
    params.courseId,
    params.executor,
  );
  const snapshotHash = computeSnapshotHash(content);
  const now = new Date();

  const existingSnapshot = await params.executor.query.coursePublicationSnapshots.findFirst({
    where: and(
      eq(coursePublicationSnapshots.publicationId, params.publication.id),
      eq(coursePublicationSnapshots.snapshotHash, snapshotHash),
    ),
  });

  const snapshot =
    existingSnapshot ??
    (
      await params.executor
        .insert(coursePublicationSnapshots)
        .values({
          publicationId: params.publication.id,
          sourceCourseId: params.courseId,
          sourceOutlineVersionId,
          snapshotHash,
          contentJson: content,
        })
        .returning()
    )[0];

  if (!snapshot) {
    throw new Error("Failed to create course publication snapshot.");
  }

  await params.executor
    .update(coursePublications)
    .set({
      currentSnapshotId: snapshot.id,
      title: content.course.title,
      description: content.course.description,
      status: "published",
      revokedAt: params.publish ? null : params.publication.revokedAt,
      publishedAt: params.publish ? now : params.publication.publishedAt,
      updatedAt: now,
    })
    .where(eq(coursePublications.id, params.publication.id));

  return {
    publicationId: params.publication.id,
    snapshotId: snapshot.id,
    slug: params.publication.slug,
    status: "published",
  };
}

export async function refreshPublishedCoursePublication(params: {
  courseId: string;
  userId: string;
  executor?: CoursePublicationWriteExecutor;
}): Promise<CoursePublicationRefreshResult | null> {
  const executor = params.executor ?? db;
  const publication = await executor.query.coursePublications.findFirst({
    where: and(
      eq(coursePublications.sourceCourseId, params.courseId),
      eq(coursePublications.status, "published"),
    ),
  });

  if (!publication) {
    return null;
  }

  if (publication.ownerUserId !== params.userId) {
    throw new Error("COURSE_PUBLICATION_FORBIDDEN");
  }

  return advanceCoursePublicationSnapshot({
    courseId: params.courseId,
    userId: params.userId,
    publication,
    executor,
    publish: false,
  });
}

export async function publishCourse(params: { courseId: string; userId: string }): Promise<{
  publicationId: string;
  snapshotId: string;
  slug: string;
  status: "published";
}> {
  const { content } = await buildPublicationSnapshotContent(params.userId, params.courseId);
  const now = new Date();

  const existing = await db.query.coursePublications.findFirst({
    where: eq(coursePublications.sourceCourseId, params.courseId),
  });
  const publication =
    existing ??
    (
      await db
        .insert(coursePublications)
        .values({
          sourceCourseId: params.courseId,
          ownerUserId: params.userId,
          slug: createPublicationSlug(),
          title: content.course.title,
          description: content.course.description,
          status: "published",
          allowAnnotations: true,
          publishedAt: now,
          updatedAt: now,
        })
        .returning()
    )[0];

  if (!publication) {
    throw new Error("Failed to create course publication.");
  }

  if (existing && existing.ownerUserId !== params.userId) {
    throw new Error("COURSE_PUBLICATION_FORBIDDEN");
  }

  return advanceCoursePublicationSnapshot({
    courseId: params.courseId,
    userId: params.userId,
    publication,
    executor: db,
    publish: true,
  });
}

export async function loadPublicationEngagementData(
  publicationId: string,
  userId: string | null,
): Promise<CoursePublicationEngagement> {
  const [counts] = await db.execute(
    sql`select
      (select count(*) from course_publication_likes where publication_id = ${publicationId}::uuid)::int as likes_count,
      (select count(*) from course_publication_urges where publication_id = ${publicationId}::uuid)::int as urges_count`,
  );
  const row = counts as unknown as { likes_count: number; urges_count: number };
  const likesCount = row?.likes_count ?? 0;
  const urgesCount = row?.urges_count ?? 0;

  if (!userId) {
    return { likesCount, urgesCount, userLiked: false, userUrged: false };
  }

  const [likeRow] = await db
    .select({ id: coursePublicationLikes.id })
    .from(coursePublicationLikes)
    .where(
      and(
        eq(coursePublicationLikes.publicationId, publicationId),
        eq(coursePublicationLikes.userId, userId),
      ),
    )
    .limit(1);

  const [urgeRow] = await db
    .select({ id: coursePublicationUrges.id })
    .from(coursePublicationUrges)
    .where(
      and(
        eq(coursePublicationUrges.publicationId, publicationId),
        eq(coursePublicationUrges.userId, userId),
      ),
    )
    .limit(1);

  return { likesCount, urgesCount, userLiked: !!likeRow, userUrged: !!urgeRow };
}

export async function getOwnedCoursePublicationStatus(params: {
  courseId: string;
  userId: string;
}): Promise<{
  published: boolean;
  slug: string | null;
  status: "published" | "revoked" | null;
  publishedAt: string | null;
  engagement: {
    likesCount: number;
    urgesCount: number;
  };
}> {
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, params.courseId), eq(courses.userId, params.userId)))
    .limit(1);
  if (!course) {
    throw new Error("COURSE_NOT_FOUND");
  }

  const publication = await db.query.coursePublications.findFirst({
    where: eq(coursePublications.sourceCourseId, params.courseId),
  });

  if (!publication) {
    return {
      published: false,
      slug: null,
      status: null,
      publishedAt: null,
      engagement: {
        likesCount: 0,
        urgesCount: 0,
      },
    };
  }

  if (publication.ownerUserId !== params.userId) {
    throw new Error("COURSE_PUBLICATION_FORBIDDEN");
  }

  const engagement = await loadPublicationEngagementData(publication.id, params.userId);

  return {
    published: publication.status === "published",
    slug: publication.slug,
    status: publication.status,
    publishedAt: publication.publishedAt?.toISOString() ?? null,
    engagement: {
      likesCount: engagement.likesCount,
      urgesCount: engagement.urgesCount,
    },
  };
}

export async function revokeCoursePublication(params: {
  courseId: string;
  userId: string;
}): Promise<{ revoked: boolean; slug?: string }> {
  const publication = await db.query.coursePublications.findFirst({
    where: eq(coursePublications.sourceCourseId, params.courseId),
  });

  if (!publication) {
    return { revoked: false };
  }

  if (publication.ownerUserId !== params.userId) {
    throw new Error("COURSE_PUBLICATION_FORBIDDEN");
  }

  await db
    .update(coursePublications)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(coursePublications.id, publication.id));

  return { revoked: true, slug: publication.slug };
}
