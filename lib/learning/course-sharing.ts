import "server-only";

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
  CoursePublicationSnapshotContent,
} from "@/db/schema/course-sharing";
import { getCoursePublicationTag, revalidateCoursePublication } from "@/lib/cache/tags";
import {
  type CoursePublicationRefreshResult,
  getOwnedCoursePublicationStatus,
  loadPublicationEngagementData,
  publishCourse,
  refreshPublishedCoursePublication,
  revokeCoursePublication,
} from "@/lib/learning/course-publication-service";
import type {
  PublicCourseAnnotationProjection,
  PublicCourseReaderProjection,
} from "@/lib/learning/course-sharing-types";
import type { LearnPageProjection, LearnProgressProjection } from "@/lib/learning/projection";

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

interface PublicCoursePublicationPointer {
  publication: {
    id: string;
    slug: string;
    ownerUserId: string;
    sourceCourseId: string;
    title: string;
    description: string | null;
    allowAnnotations: boolean;
    publishedAt: string | null;
  };
  snapshotId: string;
}

interface PublicCourseSnapshotContentProjection {
  snapshotId: string;
  content: CoursePublicationSnapshotContent;
  visibleAnnotations: PublicCourseAnnotationProjection[];
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

export {
  getOwnedCoursePublicationStatus,
  publishCourse,
  refreshPublishedCoursePublication,
  revokeCoursePublication,
};

export function revalidateCoursePublicationRefresh(
  result: CoursePublicationRefreshResult | null,
): void {
  if (!result) {
    return;
  }

  revalidateCoursePublication(result.slug);
  revalidateCoursePublication(result.publicationId);
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

async function getPublishedCoursePublicationPointer(
  slug: string,
): Promise<PublicCoursePublicationPointer | null> {
  const publication = await db.query.coursePublications.findFirst({
    where: and(eq(coursePublications.slug, slug), eq(coursePublications.status, "published")),
  });
  if (!publication?.currentSnapshotId) {
    return null;
  }

  return {
    publication: {
      id: publication.id,
      slug: publication.slug,
      ownerUserId: publication.ownerUserId,
      sourceCourseId: publication.sourceCourseId,
      title: publication.title,
      description: publication.description,
      allowAnnotations: publication.allowAnnotations,
      publishedAt: publication.publishedAt?.toISOString() ?? null,
    },
    snapshotId: publication.currentSnapshotId,
  };
}

async function getPublicCourseSnapshotContentCached(params: {
  slug: string;
  publicationId: string;
  snapshotId: string;
}): Promise<PublicCourseSnapshotContentProjection | null> {
  "use cache";

  cacheLife("days");
  cacheTag(getCoursePublicationTag(params.slug));
  cacheTag(getCoursePublicationTag(params.publicationId));

  const snapshot = await db.query.coursePublicationSnapshots.findFirst({
    where: and(
      eq(coursePublicationSnapshots.id, params.snapshotId),
      eq(coursePublicationSnapshots.publicationId, params.publicationId),
    ),
  });
  if (!snapshot) {
    return null;
  }

  const visibleAnnotations = await loadAnnotations(params.publicationId, snapshot.id, ["visible"]);

  return {
    snapshotId: snapshot.id,
    content: snapshot.contentJson,
    visibleAnnotations,
  };
}

async function getPublicCourseSnapshot(
  slug: string,
): Promise<PublicCourseSnapshotProjection | null> {
  const pointer = await getPublishedCoursePublicationPointer(slug);
  if (!pointer) {
    return null;
  }

  const snapshot = await getPublicCourseSnapshotContentCached({
    slug: pointer.publication.slug,
    publicationId: pointer.publication.id,
    snapshotId: pointer.snapshotId,
  });
  if (!snapshot) {
    return null;
  }

  return {
    publication: pointer.publication,
    snapshotId: snapshot.snapshotId,
    content: snapshot.content,
    visibleAnnotations: snapshot.visibleAnnotations,
  };
}

async function getPublicCourseLearningSnapshot(
  slug: string,
): Promise<Omit<PublicCourseLearningProjection, "progressRecord"> | null> {
  const pointer = await getPublishedCoursePublicationPointer(slug);
  if (!pointer) {
    return null;
  }

  const snapshot = await getPublicCourseSnapshotContentCached({
    slug: pointer.publication.slug,
    publicationId: pointer.publication.id,
    snapshotId: pointer.snapshotId,
  });
  if (!snapshot) {
    return null;
  }

  return {
    publication: {
      id: pointer.publication.id,
      slug: pointer.publication.slug,
      ownerUserId: pointer.publication.ownerUserId,
      sourceCourseId: pointer.publication.sourceCourseId,
    },
    snapshotId: snapshot.snapshotId,
    content: snapshot.content,
    publicAnnotations: snapshot.visibleAnnotations,
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

export async function getPublicCourseReaderData(
  slug: string,
  viewerUserId: string | null,
): Promise<PublicCourseReaderProjection | null> {
  const snapshot = await getPublicCourseSnapshot(slug);
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
    loadPublicationEngagementData(snapshot.publication.id, viewerUserId),
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
  const snapshot = await getPublicCourseLearningSnapshot(params.slug);
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
