import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";
import {
  and,
  coursePublicAnnotations,
  coursePublicationLikes,
  coursePublicationProgress,
  coursePublicationSnapshots,
  coursePublicationSubscriptions,
  coursePublications,
  coursePublicationUrges,
  courseSections,
  courses,
  db,
  desc,
  eq,
  inArray,
  sql,
  users,
} from "@/db";
import type {
  CoursePublicAnnotationAnchor,
  CoursePublicAnnotationStatus,
  CoursePublication,
  CoursePublicationSnapshotContent,
} from "@/db/schema/course-sharing";
import { getCoursePublicationTag, revalidateCoursePublication } from "@/lib/cache/tags";
import { getOwnedCourseWithOutline } from "@/lib/learning/course-repository";
import type {
  PublicCourseAnnotationProjection,
  PublicCourseReaderProjection,
} from "@/lib/learning/course-sharing-types";
import { buildSectionOutlineNodeKey } from "@/lib/learning/outline-node-key";
import type { LearnPageProjection, LearnProgressProjection } from "@/lib/learning/projection";
import { stableStringify } from "@/lib/utils/stable-data";

type PublicCourseViewerRole = PublicCourseReaderProjection["viewer"]["role"];
type CoursePublicationWriteExecutor = Pick<typeof db, "insert" | "query" | "select" | "update">;

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
  visibleAnnotations: PublicCourseAnnotationProjection[];
}

interface PublicCourseLearningProjection {
  publication: {
    id: string;
    slug: string;
    ownerUserId: string;
    sourceCourseId: string;
  };
  snapshotId: string;
  content: CoursePublicationSnapshotContent;
  progressRecord: LearnProgressProjection | null;
  publicAnnotations: PublicCourseAnnotationProjection[];
}

export interface SubscribedPublicCourseLearnPageData {
  snapshot: LearnPageProjection;
  canModeratePublicAnnotations: boolean;
}

interface PublicCourseAnnotationMutationResult {
  annotation: PublicCourseAnnotationProjection;
  publication: {
    id: string;
    slug: string;
    ownerUserId: string;
    sourceCourseId: string;
  };
}

export interface CoursePublicationRefreshResult {
  publicationId: string;
  snapshotId: string;
  slug: string;
  status: "published";
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

export function revalidateCoursePublicationRefresh(
  result: CoursePublicationRefreshResult | null,
): void {
  if (!result) {
    return;
  }

  revalidateCoursePublication(result.slug);
  revalidateCoursePublication(result.publicationId);
}

export async function refreshPublishedCoursePublication(params: {
  courseId: string;
  userId: string;
  executor?: CoursePublicationWriteExecutor;
  revalidate?: boolean;
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

  const result = await advanceCoursePublicationSnapshot({
    courseId: params.courseId,
    userId: params.userId,
    publication,
    executor,
    publish: false,
  });

  if (params.revalidate !== false) {
    revalidateCoursePublicationRefresh(result);
  }

  return result;
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

  const engagement = await loadEngagementData(publication.id, params.userId);

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

function mapAnnotationRow(row: {
  id: string;
  sectionKey: string;
  quotedText: string;
  body: string;
  anchor: CoursePublicAnnotationAnchor;
  status: CoursePublicAnnotationStatus;
  createdAt: Date | null;
  authorName: string | null;
  authorImage: string | null;
}): PublicCourseAnnotationProjection {
  return {
    id: row.id,
    sectionKey: row.sectionKey,
    quotedText: row.quotedText,
    body: row.body,
    anchor: row.anchor,
    status: row.status,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    author: {
      name: row.authorName,
      image: row.authorImage,
    },
  };
}

async function loadAnnotations(
  publicationId: string,
  snapshotId: string,
  statuses: CoursePublicAnnotationStatus[],
): Promise<PublicCourseAnnotationProjection[]> {
  const rows = await db
    .select({
      id: coursePublicAnnotations.id,
      sectionKey: coursePublicAnnotations.sectionKey,
      quotedText: coursePublicAnnotations.quotedText,
      body: coursePublicAnnotations.body,
      anchor: coursePublicAnnotations.anchor,
      status: coursePublicAnnotations.status,
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
        inArray(coursePublicAnnotations.status, statuses),
      ),
    )
    .orderBy(desc(coursePublicAnnotations.createdAt));

  return rows.map(mapAnnotationRow);
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

  const visibleAnnotations = await loadAnnotations(publication.id, snapshot.id, ["visible"]);

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
    visibleAnnotations,
  };
}

async function getPublicCourseLearningSnapshotCached(
  slug: string,
): Promise<Omit<PublicCourseLearningProjection, "progressRecord"> | null> {
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

  const publicAnnotations = await loadAnnotations(publication.id, snapshot.id, ["visible"]);

  return {
    publication: {
      id: publication.id,
      slug: publication.slug,
      ownerUserId: publication.ownerUserId,
      sourceCourseId: publication.sourceCourseId,
    },
    snapshotId: snapshot.id,
    content: snapshot.contentJson,
    publicAnnotations,
  };
}

async function hasPublicationSubscription(
  publicationId: string,
  userId: string | null,
): Promise<boolean> {
  if (!userId) {
    return false;
  }

  const subscription = await db.query.coursePublicationSubscriptions.findFirst({
    where: and(
      eq(coursePublicationSubscriptions.publicationId, publicationId),
      eq(coursePublicationSubscriptions.userId, userId),
    ),
  });

  return Boolean(subscription);
}

async function loadPublicationProgressRecord(
  publicationId: string,
  userId: string,
): Promise<LearnProgressProjection | null> {
  const [progress] = await db
    .select({
      currentChapter: coursePublicationProgress.currentChapter,
      completedSections: coursePublicationProgress.completedSections,
      completedAt: coursePublicationProgress.completedAt,
    })
    .from(coursePublicationProgress)
    .where(
      and(
        eq(coursePublicationProgress.publicationId, publicationId),
        eq(coursePublicationProgress.userId, userId),
      ),
    )
    .limit(1);

  return progress ?? null;
}

function buildLearnPageProjectionFromPublication(
  snapshot: PublicCourseLearningProjection,
): LearnPageProjection {
  return {
    courseTitle: snapshot.content.course.title,
    courseDescription: snapshot.content.course.description,
    difficulty: snapshot.content.course.difficulty,
    estimatedMinutes: snapshot.content.course.estimatedMinutes,
    learningOutcome: snapshot.content.course.learningOutcome,
    targetAudience: snapshot.content.course.targetAudience,
    chapters: snapshot.content.outline.chapters.map((chapter) => ({
      title: chapter.title,
      description: chapter.description,
      sections: chapter.sections.map((section) => ({
        title: section.title,
        description: section.description,
        nodeId: section.nodeId,
      })),
    })),
    sectionDocs: snapshot.content.sections.map((section) => ({
      id: `${snapshot.publication.id}:${section.nodeId}`,
      title: section.title,
      content: section.content,
      outlineNodeKey: section.nodeId,
      annotations: [],
    })),
    publicAnnotations: snapshot.publicAnnotations.map((annotation) => ({
      id: annotation.id,
      sectionKey: annotation.sectionKey,
      quotedText: annotation.quotedText,
      body: annotation.body,
      status: annotation.status,
      createdAt: annotation.createdAt,
      author: annotation.author,
      publicationSlug: snapshot.publication.slug,
    })),
    progressRecord: snapshot.progressRecord,
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

async function loadEngagementData(
  publicationId: string,
  userId: string | null,
): Promise<{ likesCount: number; urgesCount: number; userLiked: boolean; userUrged: boolean }> {
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

export async function getPublicCourseReaderData(
  slug: string,
  viewerUserId: string | null,
): Promise<PublicCourseReaderProjection | null> {
  const snapshot = await getPublicCourseSnapshotCached(slug);
  if (!snapshot) {
    return null;
  }

  const role = getPublicCourseViewerRole(snapshot.publication.ownerUserId, viewerUserId);
  const [annotations, subscribed, engagement] = await Promise.all([
    role === "owner"
      ? loadAnnotations(snapshot.publication.id, snapshot.snapshotId, ["visible", "hidden"])
      : Promise.resolve(snapshot.visibleAnnotations),
    role === "owner"
      ? Promise.resolve(false)
      : hasPublicationSubscription(snapshot.publication.id, viewerUserId),
    loadEngagementData(snapshot.publication.id, viewerUserId),
  ]);

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
    annotations,
    subscription: {
      active: subscribed,
      learnUrl: subscribed ? `/c/${snapshot.publication.slug}/learn` : null,
    },
    viewer: {
      userId: viewerUserId,
      role,
      liked: engagement.userLiked,
      urged: engagement.userUrged,
    },
    engagement: {
      likesCount: engagement.likesCount,
      urgesCount: engagement.urgesCount,
    },
    capabilities: {
      canAnnotatePublicly: Boolean(viewerUserId && snapshot.publication.allowAnnotations),
      canModeratePublicAnnotations: role === "owner",
      canSaveToLibrary: role !== "owner",
    },
  };
}

export async function getSubscribedPublicCourseLearnPage(params: {
  slug: string;
  userId: string;
}): Promise<SubscribedPublicCourseLearnPageData | null> {
  const snapshot = await getPublicCourseLearningSnapshotCached(params.slug);
  if (!snapshot) {
    return null;
  }

  const isOwner = snapshot.publication.ownerUserId === params.userId;
  if (!isOwner) {
    const isSubscribed = await hasPublicationSubscription(snapshot.publication.id, params.userId);
    if (!isSubscribed) {
      return null;
    }
  }

  const progressRecord = await loadPublicationProgressRecord(
    snapshot.publication.id,
    params.userId,
  );

  return {
    snapshot: buildLearnPageProjectionFromPublication({
      ...snapshot,
      progressRecord,
    }),
    canModeratePublicAnnotations: isOwner,
  };
}

export async function getPublicCourseProgressTarget(params: {
  slug: string;
  userId: string;
}): Promise<{
  publicationId: string;
  sourceCourseId: string;
  ownerUserId: string;
  currentSnapshotId: string;
  content: CoursePublicationSnapshotContent;
  existingProgress: {
    id: string;
    currentChapter: number;
    completedChapters: number[];
    completedSections: string[];
    startedAt: Date | null;
    completedAt: Date | null;
  } | null;
}> {
  const publication = await db.query.coursePublications.findFirst({
    where: and(
      eq(coursePublications.slug, params.slug),
      eq(coursePublications.status, "published"),
    ),
  });
  if (!publication?.currentSnapshotId) {
    throw new Error("COURSE_PUBLICATION_NOT_FOUND");
  }

  if (publication.ownerUserId !== params.userId) {
    const isSubscribed = await hasPublicationSubscription(publication.id, params.userId);
    if (!isSubscribed) {
      throw new Error("COURSE_PUBLICATION_SUBSCRIPTION_REQUIRED");
    }
  }

  const snapshot = await db.query.coursePublicationSnapshots.findFirst({
    where: eq(coursePublicationSnapshots.id, publication.currentSnapshotId),
  });
  if (!snapshot) {
    throw new Error("COURSE_PUBLICATION_NOT_FOUND");
  }

  const [existingProgress] = await db
    .select({
      id: coursePublicationProgress.id,
      currentChapter: coursePublicationProgress.currentChapter,
      completedChapters: coursePublicationProgress.completedChapters,
      completedSections: coursePublicationProgress.completedSections,
      startedAt: coursePublicationProgress.startedAt,
      completedAt: coursePublicationProgress.completedAt,
    })
    .from(coursePublicationProgress)
    .where(
      and(
        eq(coursePublicationProgress.publicationId, publication.id),
        eq(coursePublicationProgress.userId, params.userId),
      ),
    )
    .limit(1);

  return {
    publicationId: publication.id,
    sourceCourseId: publication.sourceCourseId,
    ownerUserId: publication.ownerUserId,
    currentSnapshotId: publication.currentSnapshotId,
    content: snapshot.contentJson,
    existingProgress: existingProgress ?? null,
  };
}

export async function persistPublicCourseProgress(params: {
  publicationId: string;
  userId: string;
  progress: {
    currentChapter: number;
    completedChapters: number[];
    completedSections: string[];
    startedAt: Date | null;
    completedAt: Date | null;
  };
  existingRecordId?: string;
}): Promise<void> {
  const values = {
    ...params.progress,
    updatedAt: new Date(),
  };

  if (params.existingRecordId) {
    await db
      .update(coursePublicationProgress)
      .set(values)
      .where(eq(coursePublicationProgress.id, params.existingRecordId));
    return;
  }

  await db.insert(coursePublicationProgress).values({
    publicationId: params.publicationId,
    userId: params.userId,
    ...values,
  });
}

export async function createPublicCourseAnnotation(params: {
  slug: string;
  userId: string;
  sectionKey: string;
  anchor: CoursePublicAnnotationAnchor;
  quotedText: string;
  body: string;
}): Promise<PublicCourseAnnotationMutationResult> {
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
    annotation: {
      id: annotation.id,
      sectionKey: params.sectionKey,
      quotedText: params.quotedText,
      body: params.body,
      anchor: params.anchor,
      status: "visible",
      createdAt,
      author: {
        name: user?.name ?? null,
        image: user?.image ?? null,
      },
    },
    publication: {
      id: publication.id,
      slug: publication.slug,
      ownerUserId: publication.ownerUserId,
      sourceCourseId: publication.sourceCourseId,
    },
  };
}

export async function updatePublicCourseAnnotationStatus(params: {
  slug: string;
  annotationId: string;
  userId: string;
  status: CoursePublicAnnotationStatus;
}): Promise<PublicCourseAnnotationMutationResult> {
  const publication = await db.query.coursePublications.findFirst({
    where: and(
      eq(coursePublications.slug, params.slug),
      eq(coursePublications.status, "published"),
    ),
  });

  if (!publication?.currentSnapshotId) {
    throw new Error("COURSE_PUBLICATION_NOT_FOUND");
  }

  if (publication.ownerUserId !== params.userId) {
    throw new Error("COURSE_PUBLICATION_FORBIDDEN");
  }

  const [updated] = await db
    .update(coursePublicAnnotations)
    .set({
      status: params.status,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(coursePublicAnnotations.id, params.annotationId),
        eq(coursePublicAnnotations.publicationId, publication.id),
        eq(coursePublicAnnotations.snapshotId, publication.currentSnapshotId),
      ),
    )
    .returning({
      id: coursePublicAnnotations.id,
      sectionKey: coursePublicAnnotations.sectionKey,
      quotedText: coursePublicAnnotations.quotedText,
      body: coursePublicAnnotations.body,
      anchor: coursePublicAnnotations.anchor,
      status: coursePublicAnnotations.status,
      createdAt: coursePublicAnnotations.createdAt,
      userId: coursePublicAnnotations.userId,
    });

  if (!updated) {
    throw new Error("COURSE_PUBLIC_ANNOTATION_NOT_FOUND");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, updated.userId),
  });

  return {
    annotation: mapAnnotationRow({
      ...updated,
      authorName: user?.name ?? null,
      authorImage: user?.image ?? null,
    }),
    publication: {
      id: publication.id,
      slug: publication.slug,
      ownerUserId: publication.ownerUserId,
      sourceCourseId: publication.sourceCourseId,
    },
  };
}

export async function subscribePublicCourse(params: {
  slug: string;
  userId: string;
}): Promise<{ publicationId: string; slug: string; learnUrl: string; alreadySubscribed: boolean }> {
  const publication = await db.query.coursePublications.findFirst({
    where: and(
      eq(coursePublications.slug, params.slug),
      eq(coursePublications.status, "published"),
    ),
  });
  if (!publication?.currentSnapshotId) {
    throw new Error("COURSE_PUBLICATION_NOT_FOUND");
  }

  if (publication.ownerUserId === params.userId) {
    throw new Error("COURSE_PUBLICATION_SUBSCRIBE_FORBIDDEN");
  }

  const lockKey = `${publication.id}:${params.userId}`;

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0::bigint))`);

    const [existingSubscription] = await tx
      .select({ id: coursePublicationSubscriptions.id })
      .from(coursePublicationSubscriptions)
      .where(
        and(
          eq(coursePublicationSubscriptions.publicationId, publication.id),
          eq(coursePublicationSubscriptions.userId, params.userId),
        ),
      )
      .limit(1);

    if (!existingSubscription) {
      await tx.insert(coursePublicationSubscriptions).values({
        publicationId: publication.id,
        userId: params.userId,
        lastSeenSnapshotId: publication.currentSnapshotId,
        updatedAt: new Date(),
      });
    }

    return {
      publicationId: publication.id,
      slug: publication.slug,
      learnUrl: `/c/${publication.slug}/learn`,
      alreadySubscribed: Boolean(existingSubscription),
    };
  });
}

export async function togglePublicCourseLike(params: {
  slug: string;
  userId: string;
}): Promise<{ liked: boolean }> {
  const publication = await db.query.coursePublications.findFirst({
    where: and(
      eq(coursePublications.slug, params.slug),
      eq(coursePublications.status, "published"),
    ),
  });

  if (!publication) {
    throw new Error("COURSE_PUBLICATION_NOT_FOUND");
  }

  const existing = await db.query.coursePublicationLikes.findFirst({
    where: and(
      eq(coursePublicationLikes.publicationId, publication.id),
      eq(coursePublicationLikes.userId, params.userId),
    ),
  });

  if (existing) {
    await db.delete(coursePublicationLikes).where(eq(coursePublicationLikes.id, existing.id));
    revalidateCoursePublication(publication.slug);
    return { liked: false };
  }

  await db.insert(coursePublicationLikes).values({
    publicationId: publication.id,
    userId: params.userId,
  });

  revalidateCoursePublication(publication.slug);
  return { liked: true };
}

export async function submitPublicCourseUrge(params: {
  slug: string;
  userId: string;
}): Promise<{ urged: boolean }> {
  const publication = await db.query.coursePublications.findFirst({
    where: and(
      eq(coursePublications.slug, params.slug),
      eq(coursePublications.status, "published"),
    ),
  });

  if (!publication) {
    throw new Error("COURSE_PUBLICATION_NOT_FOUND");
  }

  const existing = await db.query.coursePublicationUrges.findFirst({
    where: and(
      eq(coursePublicationUrges.publicationId, publication.id),
      eq(coursePublicationUrges.userId, params.userId),
    ),
  });

  if (existing) {
    await db.delete(coursePublicationUrges).where(eq(coursePublicationUrges.id, existing.id));
    revalidateCoursePublication(publication.slug);
    return { urged: false };
  }

  await db.insert(coursePublicationUrges).values({
    publicationId: publication.id,
    userId: params.userId,
  });

  revalidateCoursePublication(publication.slug);
  return { urged: true };
}
