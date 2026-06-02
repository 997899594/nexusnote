import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";
import {
  and,
  courseOutlineNodes,
  courseOutlineVersions,
  courseProgress,
  coursePublicAnnotations,
  coursePublicationSnapshots,
  coursePublications,
  courseSections,
  courses,
  db,
  desc,
  eq,
  users,
} from "@/db";
import type {
  CoursePublicAnnotationAnchor,
  CoursePublicationSnapshotContent,
} from "@/db/schema/course-sharing";
import { getCoursePublicationTag } from "@/lib/cache/tags";
import type { CourseOutline } from "@/lib/learning/course-outline";
import { getOwnedCourseWithOutline } from "@/lib/learning/course-repository";
import type {
  PublicCourseAnnotationProjection,
  PublicCourseReaderProjection,
} from "@/lib/learning/course-sharing-types";
import {
  buildCourseOutlineNodeValues,
  buildCourseOutlineVersionValues,
} from "@/lib/learning/course-structure";
import { buildSectionOutlineNodeKey } from "@/lib/learning/outline-node-key";
import { stableStringify } from "@/lib/utils/stable-data";

type PublicCourseViewerRole = PublicCourseReaderProjection["viewer"]["role"];

interface PublicCourseSnapshotProjection {
  publication: {
    id: string;
    slug: string;
    ownerUserId: string;
    title: string;
    description: string | null;
    allowAnnotations: boolean;
    publishedAt: string | null;
  };
  snapshotId: string;
  content: CoursePublicationSnapshotContent;
  annotations: PublicCourseAnnotationProjection[];
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

async function loadSectionRows(courseId: string) {
  return db
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
): Promise<{
  sourceOutlineVersionId: string;
  content: CoursePublicationSnapshotContent;
}> {
  const course = await getOwnedCourseWithOutline(courseId, userId);
  if (!course) {
    throw new Error("COURSE_NOT_FOUND");
  }

  const sectionRows = await loadSectionRows(courseId);
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

export async function publishCourse(params: { courseId: string; userId: string }): Promise<{
  publicationId: string;
  snapshotId: string;
  slug: string;
  status: "published";
}> {
  const { sourceOutlineVersionId, content } = await buildPublicationSnapshotContent(
    params.userId,
    params.courseId,
  );
  const snapshotHash = computeSnapshotHash(content);
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

  const existingSnapshot = await db.query.coursePublicationSnapshots.findFirst({
    where: and(
      eq(coursePublicationSnapshots.publicationId, publication.id),
      eq(coursePublicationSnapshots.snapshotHash, snapshotHash),
    ),
  });

  const snapshot =
    existingSnapshot ??
    (
      await db
        .insert(coursePublicationSnapshots)
        .values({
          publicationId: publication.id,
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

  await db
    .update(coursePublications)
    .set({
      currentSnapshotId: snapshot.id,
      title: content.course.title,
      description: content.course.description,
      status: "published",
      revokedAt: null,
      publishedAt: now,
      updatedAt: now,
    })
    .where(eq(coursePublications.id, publication.id));

  return {
    publicationId: publication.id,
    snapshotId: snapshot.id,
    slug: publication.slug,
    status: "published",
  };
}

export async function getOwnedCoursePublicationStatus(params: {
  courseId: string;
  userId: string;
}): Promise<{
  published: boolean;
  slug: string | null;
  status: "published" | "revoked" | null;
  publishedAt: string | null;
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
    };
  }

  if (publication.ownerUserId !== params.userId) {
    throw new Error("COURSE_PUBLICATION_FORBIDDEN");
  }

  return {
    published: publication.status === "published",
    slug: publication.slug,
    status: publication.status,
    publishedAt: publication.publishedAt?.toISOString() ?? null,
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

async function loadVisibleAnnotations(
  publicationId: string,
  snapshotId: string,
): Promise<PublicCourseAnnotationProjection[]> {
  const rows = await db
    .select({
      id: coursePublicAnnotations.id,
      sectionKey: coursePublicAnnotations.sectionKey,
      quotedText: coursePublicAnnotations.quotedText,
      body: coursePublicAnnotations.body,
      anchor: coursePublicAnnotations.anchor,
      createdAt: coursePublicAnnotations.createdAt,
      authorName: users.name,
      authorImage: users.image,
    })
    .from(coursePublicAnnotations)
    .innerJoin(users, eq(coursePublicAnnotations.userId, users.id))
    .where(
      and(
        eq(coursePublicAnnotations.publicationId, publicationId),
        eq(coursePublicAnnotations.snapshotId, snapshotId),
        eq(coursePublicAnnotations.status, "visible"),
      ),
    )
    .orderBy(desc(coursePublicAnnotations.createdAt));

  return rows.map((row) => ({
    id: row.id,
    sectionKey: row.sectionKey,
    quotedText: row.quotedText,
    body: row.body,
    anchor: row.anchor,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    author: {
      name: row.authorName,
      image: row.authorImage,
    },
  }));
}

async function getPublicCourseSnapshotCached(
  slug: string,
): Promise<PublicCourseSnapshotProjection | null> {
  "use cache";

  cacheLife("days");
  cacheTag(getCoursePublicationTag(slug));

  const publication = await db.query.coursePublications.findFirst({
    where: and(eq(coursePublications.slug, slug), eq(coursePublications.status, "published")),
  });
  if (!publication?.currentSnapshotId) {
    return null;
  }
  cacheTag(getCoursePublicationTag(publication.id));

  const snapshot = await db.query.coursePublicationSnapshots.findFirst({
    where: eq(coursePublicationSnapshots.id, publication.currentSnapshotId),
  });
  if (!snapshot) {
    return null;
  }

  const annotations = await loadVisibleAnnotations(publication.id, snapshot.id);

  return {
    publication: {
      id: publication.id,
      slug: publication.slug,
      ownerUserId: publication.ownerUserId,
      title: publication.title,
      description: publication.description,
      allowAnnotations: publication.allowAnnotations,
      publishedAt: publication.publishedAt?.toISOString() ?? null,
    },
    snapshotId: snapshot.id,
    content: snapshot.contentJson,
    annotations,
  };
}

function getPublicCourseViewerRole(
  ownerUserId: string,
  viewerUserId: string | null,
): PublicCourseViewerRole {
  if (!viewerUserId) {
    return "guest";
  }

  return viewerUserId === ownerUserId ? "owner" : "reader";
}

export async function getPublicCourseReaderData(
  slug: string,
  viewerUserId: string | null,
): Promise<PublicCourseReaderProjection | null> {
  const snapshot = await getPublicCourseSnapshotCached(slug);
  if (!snapshot) {
    return null;
  }

  const role = getPublicCourseViewerRole(snapshot.publication.ownerUserId, viewerUserId);

  return {
    publication: {
      id: snapshot.publication.id,
      slug: snapshot.publication.slug,
      title: snapshot.publication.title,
      description: snapshot.publication.description,
      allowAnnotations: snapshot.publication.allowAnnotations,
      publishedAt: snapshot.publication.publishedAt,
    },
    snapshotId: snapshot.snapshotId,
    content: snapshot.content,
    annotations: snapshot.annotations,
    viewer: {
      userId: viewerUserId,
      role,
    },
    capabilities: {
      canAnnotatePublicly: Boolean(viewerUserId && snapshot.publication.allowAnnotations),
      canModeratePublicAnnotations: role === "owner",
      canSaveToLibrary: role !== "owner",
    },
  };
}

export async function createPublicCourseAnnotation(params: {
  slug: string;
  userId: string;
  sectionKey: string;
  anchor: CoursePublicAnnotationAnchor;
  quotedText: string;
  body: string;
}): Promise<PublicCourseAnnotationProjection> {
  const publication = await db.query.coursePublications.findFirst({
    where: and(
      eq(coursePublications.slug, params.slug),
      eq(coursePublications.status, "published"),
    ),
  });

  if (!publication?.currentSnapshotId || !publication.allowAnnotations) {
    throw new Error("COURSE_PUBLICATION_NOT_FOUND");
  }

  const snapshot = await db.query.coursePublicationSnapshots.findFirst({
    where: eq(coursePublicationSnapshots.id, publication.currentSnapshotId),
  });
  if (!snapshot) {
    throw new Error("COURSE_PUBLICATION_NOT_FOUND");
  }

  const hasSection = snapshot.contentJson.sections.some(
    (section) => section.nodeId === params.sectionKey,
  );
  if (!hasSection) {
    throw new Error("COURSE_PUBLICATION_SECTION_NOT_FOUND");
  }

  const [annotation] = await db
    .insert(coursePublicAnnotations)
    .values({
      publicationId: publication.id,
      snapshotId: publication.currentSnapshotId,
      sectionKey: params.sectionKey,
      userId: params.userId,
      anchor: params.anchor,
      quotedText: params.quotedText,
      body: params.body,
      status: "visible",
      updatedAt: new Date(),
    })
    .returning({ id: coursePublicAnnotations.id });

  if (!annotation) {
    throw new Error("Failed to create public annotation.");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, params.userId),
  });
  const createdAt = new Date().toISOString();

  return {
    id: annotation.id,
    sectionKey: params.sectionKey,
    quotedText: params.quotedText,
    body: params.body,
    anchor: params.anchor,
    createdAt,
    author: {
      name: user?.name ?? null,
      image: user?.image ?? null,
    },
  };
}

function buildOutlineFromSnapshot(content: CoursePublicationSnapshotContent): CourseOutline {
  return {
    title: content.course.title,
    description: content.course.description ?? "从公开课程保存的学习内容。",
    targetAudience: content.course.targetAudience ?? "自主学习者",
    difficulty: (content.course.difficulty ?? "intermediate") as CourseOutline["difficulty"],
    courseSkillIds: [],
    learningOutcome:
      content.course.learningOutcome ?? content.course.description ?? "完成课程学习。",
    prerequisites: [],
    researchCitations: content.citations.map((citation) => ({
      id: citation.id,
      title: citation.title,
      url: citation.url,
      domain: citation.domain,
      snippet: citation.snippet,
      sourceType: citation.sourceType,
      publishedAt: citation.publishedAt,
    })),
    chapters: content.outline.chapters.map((chapter) => ({
      title: chapter.title,
      description: chapter.description || undefined,
      sections: chapter.sections.map((section) => ({
        title: section.title,
        description: section.description || undefined,
      })),
    })),
  };
}

export async function savePublicCourseToLibrary(params: {
  slug: string;
  userId: string;
}): Promise<{ courseId: string }> {
  const publication = await db.query.coursePublications.findFirst({
    where: and(
      eq(coursePublications.slug, params.slug),
      eq(coursePublications.status, "published"),
    ),
  });
  if (!publication?.currentSnapshotId) {
    throw new Error("COURSE_PUBLICATION_NOT_FOUND");
  }

  const snapshot = await db.query.coursePublicationSnapshots.findFirst({
    where: eq(coursePublicationSnapshots.id, publication.currentSnapshotId),
  });
  if (!snapshot) {
    throw new Error("COURSE_PUBLICATION_NOT_FOUND");
  }

  const outline = buildOutlineFromSnapshot(snapshot.contentJson);

  return db.transaction(async (tx) => {
    const [createdCourse] = await tx
      .insert(courses)
      .values({
        userId: params.userId,
        title: outline.title,
        description: outline.description ?? null,
        difficulty: outline.difficulty,
        estimatedMinutes: snapshot.contentJson.course.estimatedMinutes,
        updatedAt: new Date(),
      })
      .returning({ id: courses.id });

    if (!createdCourse) {
      throw new Error("Failed to save public course.");
    }

    const [outlineVersion] = await tx
      .insert(courseOutlineVersions)
      .values(buildCourseOutlineVersionValues({ courseId: createdCourse.id, outline }))
      .returning({ id: courseOutlineVersions.id });

    if (!outlineVersion) {
      throw new Error("Failed to save public course outline.");
    }

    await tx.insert(courseOutlineNodes).values(
      buildCourseOutlineNodeValues({
        courseId: createdCourse.id,
        outlineVersionId: outlineVersion.id,
        outline,
      }),
    );

    const sections = snapshot.contentJson.sections.map((section) => ({
      courseId: createdCourse.id,
      outlineNodeKey: section.nodeId,
      title: section.title ?? "未命名小节",
      contentMarkdown: section.content,
      plainText: section.content,
      updatedAt: new Date(),
    }));

    if (sections.length > 0) {
      await tx.insert(courseSections).values(sections);
    }

    await tx.insert(courseProgress).values({
      courseId: createdCourse.id,
      userId: params.userId,
      currentChapter: 0,
      completedChapters: [],
      completedSections: [],
      startedAt: new Date(),
      completedAt: null,
      updatedAt: new Date(),
    });

    return { courseId: createdCourse.id };
  });
}
