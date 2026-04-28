import type { UIMessage } from "ai";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  conversations,
  courseSectionAnnotations,
  courseSections,
  courses,
  db,
  knowledgeEvidence,
  knowledgeEvidenceEvents,
  knowledgeGenerationRuns,
  notes,
  userCareerTreeSnapshots,
  userFocusSnapshots,
  userProfileSnapshots,
} from "@/db";
import { syncConversationKnowledge } from "@/lib/chat/conversation-knowledge";
import { extractMessageText, loadConversationMessagesMap } from "@/lib/chat/conversation-messages";
import { getUserGrowthContext } from "@/lib/growth/generation-context";
import {
  focusSnapshotPayloadSchema,
  profileSnapshotPayloadSchema,
} from "@/lib/growth/projection-types";
import { enqueueGrowthExtract } from "@/lib/growth/queue";
import {
  runGrowthCoursePipeline,
  runGrowthProjectionPipeline,
  runGrowthRefreshPipeline,
  runGrowthSourcePipeline,
} from "@/lib/growth/runtime";
import { careerTreeSnapshotSchema } from "@/lib/growth/types";
import { resolveNoteBackedKnowledgeSourceType } from "@/lib/knowledge/source-types";
import {
  type AnnotationKnowledgeRecord,
  syncSectionAnnotationsKnowledge,
} from "@/lib/learning/annotation-knowledge";
import { syncCourseSectionKnowledge } from "@/lib/learning/course-section-knowledge";
import { parseSectionOutlineNodeKey } from "@/lib/learning/outline-node-key";
import { syncNoteKnowledge } from "@/lib/notes/knowledge";
import type { NoteRecord } from "@/lib/notes/repository";

export interface GrowthRuntimeFilters {
  courseId?: string;
  userId?: string;
  limit?: number;
}

export interface RuntimeTargetCourse {
  id: string;
  userId: string;
  title: string;
}

export interface RuntimeSectionDocument {
  documentId: string;
  userId: string;
  courseId: string;
  sectionTitle: string;
  plainText: string;
  chapterIndex: number;
  sectionIndex: number;
}

export interface RuntimeAnnotationSource {
  sectionId: string;
  userId: string;
  courseId: string;
  courseTitle: string;
  chapterKey: string | null;
  annotations: AnnotationKnowledgeRecord[];
}

export interface RuntimeConversationSource {
  id: string;
  userId: string;
  title: string;
  messages: UIMessage[];
}

export interface RuntimeUserBundle {
  userId: string;
  courses: RuntimeTargetCourse[];
  sectionDocuments: RuntimeSectionDocument[];
  annotationSources: RuntimeAnnotationSource[];
  notes: NoteRecord[];
  conversations: RuntimeConversationSource[];
}

export interface RuntimeUserBundleSummary {
  courses: number;
  sectionDocuments: number;
  annotationSources: number;
  notes: number;
  conversations: number;
}

export interface RuntimeUserVerificationSummary {
  userId: string;
  treeCount: number;
  focusTitle: string | null;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function hasSourceTextContent(messages: UIMessage[]): boolean {
  return messages.some((message) => extractMessageText(message).trim().length > 0);
}

function hasNoteContent(note: Pick<NoteRecord, "plainText" | "contentHtml">): boolean {
  return Boolean(note.plainText?.trim() || note.contentHtml?.trim());
}

export async function loadTargetCourses(
  filters: GrowthRuntimeFilters,
): Promise<RuntimeTargetCourse[]> {
  const query = db
    .select({
      id: courses.id,
      userId: courses.userId,
      title: courses.title,
    })
    .from(courses)
    .where(
      filters.courseId
        ? eq(courses.id, filters.courseId)
        : filters.userId
          ? eq(courses.userId, filters.userId)
          : undefined,
    )
    .orderBy(asc(courses.userId), asc(courses.title));

  return typeof filters.limit === "number" ? query.limit(filters.limit) : query;
}

export function groupCoursesByUser(
  allCourses: RuntimeTargetCourse[],
): Map<string, RuntimeTargetCourse[]> {
  const grouped = new Map<string, RuntimeTargetCourse[]>();

  for (const course of allCourses) {
    const existing = grouped.get(course.userId) ?? [];
    existing.push(course);
    grouped.set(course.userId, existing);
  }

  return grouped;
}

async function loadSectionDocuments(
  userId: string,
  courseIds: string[],
): Promise<RuntimeSectionDocument[]> {
  if (courseIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      documentId: courseSections.id,
      courseId: courseSections.courseId,
      sectionTitle: courseSections.title,
      plainText: courseSections.plainText,
      userId: courses.userId,
      outlineNodeKey: courseSections.outlineNodeKey,
    })
    .from(courseSections)
    .innerJoin(courses, eq(courseSections.courseId, courses.id))
    .where(and(eq(courses.userId, userId), inArray(courseSections.courseId, courseIds)));

  return rows
    .map((row) => {
      const parsedNodeKey = parseSectionOutlineNodeKey(row.outlineNodeKey);
      if (!parsedNodeKey) {
        return null;
      }

      return {
        documentId: row.documentId,
        userId: row.userId,
        courseId: row.courseId,
        sectionTitle: row.sectionTitle,
        plainText: row.plainText ?? "",
        chapterIndex: parsedNodeKey.chapterIndex,
        sectionIndex: parsedNodeKey.sectionIndex,
      };
    })
    .filter((row): row is RuntimeSectionDocument => Boolean(row));
}

async function loadAnnotationSources(
  userId: string,
  courseIds: string[],
): Promise<RuntimeAnnotationSource[]> {
  if (courseIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      sectionId: courseSections.id,
      courseId: courses.id,
      courseTitle: courses.title,
      outlineNodeKey: courseSections.outlineNodeKey,
      annotationId: courseSectionAnnotations.id,
      type: courseSectionAnnotations.type,
      anchor: courseSectionAnnotations.anchor,
      color: courseSectionAnnotations.color,
      noteContent: courseSectionAnnotations.noteContent,
      createdAt: courseSectionAnnotations.createdAt,
    })
    .from(courseSectionAnnotations)
    .innerJoin(courseSections, eq(courseSectionAnnotations.courseSectionId, courseSections.id))
    .innerJoin(courses, eq(courseSections.courseId, courses.id))
    .where(and(eq(courseSectionAnnotations.userId, userId), inArray(courses.id, courseIds)))
    .orderBy(asc(courseSections.id), asc(courseSectionAnnotations.createdAt));

  const grouped = new Map<string, RuntimeAnnotationSource>();

  for (const row of rows) {
    const parsedNodeKey = parseSectionOutlineNodeKey(row.outlineNodeKey);
    const existing = grouped.get(row.sectionId) ?? {
      sectionId: row.sectionId,
      userId,
      courseId: row.courseId,
      courseTitle: row.courseTitle,
      chapterKey: parsedNodeKey?.chapterKey ?? null,
      annotations: [],
    };

    existing.annotations.push({
      id: row.annotationId,
      type: row.type as AnnotationKnowledgeRecord["type"],
      anchor: row.anchor as AnnotationKnowledgeRecord["anchor"],
      color: row.color ?? null,
      noteContent: row.noteContent ?? null,
      createdAt: row.createdAt ?? new Date(),
    });

    grouped.set(row.sectionId, existing);
  }

  return [...grouped.values()];
}

async function loadUserNotes(userId: string): Promise<NoteRecord[]> {
  return db.query.notes.findMany({
    where: eq(notes.userId, userId),
    orderBy: asc(notes.updatedAt),
  });
}

async function loadUserConversations(userId: string): Promise<RuntimeConversationSource[]> {
  const conversationRows = await db.query.conversations.findMany({
    where: eq(conversations.userId, userId),
    orderBy: asc(conversations.updatedAt),
  });
  const messagesByConversation = await loadConversationMessagesMap(
    conversationRows.map((conversation) => conversation.id),
  );

  return conversationRows.map((conversation) => ({
    id: conversation.id,
    userId,
    title: conversation.title,
    messages: messagesByConversation.get(conversation.id) ?? [],
  }));
}

export async function loadRuntimeUserBundle(params: {
  userId: string;
  courses: RuntimeTargetCourse[];
}): Promise<RuntimeUserBundle> {
  const courseIds = params.courses.map((course) => course.id);
  const [sectionDocuments, annotationSources, userNotes, userConversations] = await Promise.all([
    loadSectionDocuments(params.userId, courseIds),
    loadAnnotationSources(params.userId, courseIds),
    loadUserNotes(params.userId),
    loadUserConversations(params.userId),
  ]);

  return {
    userId: params.userId,
    courses: params.courses,
    sectionDocuments,
    annotationSources,
    notes: userNotes,
    conversations: userConversations,
  };
}

export async function loadRuntimeBundlesForFilters(filters: GrowthRuntimeFilters): Promise<{
  targetCourses: RuntimeTargetCourse[];
  bundles: RuntimeUserBundle[];
}> {
  const targetCourses = await loadTargetCourses(filters);
  const bundles = await Promise.all(
    [...groupCoursesByUser(targetCourses)].map(([userId, userCourses]) =>
      loadRuntimeUserBundle({
        userId,
        courses: userCourses,
      }),
    ),
  );

  return {
    targetCourses,
    bundles,
  };
}

export function summarizeRuntimeUserBundle(bundle: RuntimeUserBundle) {
  return {
    courses: bundle.courses.length,
    sectionDocuments: bundle.sectionDocuments.length,
    annotationSources: bundle.annotationSources.length,
    notes: bundle.notes.length,
    conversations: bundle.conversations.length,
  } satisfies RuntimeUserBundleSummary;
}

async function runManualSourceFollowup(params: {
  userId: string;
  sourceType: string;
  sourceId: string;
  affectedNodeIds: string[];
  hasContent: boolean;
  reasonKey: string;
}): Promise<void> {
  if (params.hasContent) {
    await runGrowthSourcePipeline({
      userId: params.userId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      affectedNodeIds: params.affectedNodeIds,
    });
    return;
  }

  if (params.affectedNodeIds.length > 0) {
    await runGrowthRefreshPipeline({
      userId: params.userId,
      nodeIds: params.affectedNodeIds,
      reasonKey: params.reasonKey,
    });
  }
}

export async function runRuntimeUserBackfill(params: {
  bundle: RuntimeUserBundle;
  sync: boolean;
}): Promise<void> {
  const { bundle, sync } = params;

  for (const course of bundle.courses) {
    if (sync) {
      await runGrowthCoursePipeline({
        userId: bundle.userId,
        courseId: course.id,
      });
    } else {
      await enqueueGrowthExtract(bundle.userId, course.id);
    }
  }

  for (const sectionDocument of bundle.sectionDocuments) {
    const syncResult = await syncCourseSectionKnowledge({
      ...sectionDocument,
      enqueueFollowups: !sync,
    });

    if (sync) {
      await runManualSourceFollowup({
        userId: bundle.userId,
        sourceType: "course_section",
        sourceId: sectionDocument.documentId,
        affectedNodeIds: syncResult.affectedNodeIds,
        hasContent: sectionDocument.plainText.trim().length > 0,
        reasonKey: `backfill:course-section:${sectionDocument.documentId}`,
      });
    }
  }

  for (const annotationSource of bundle.annotationSources) {
    const affectedNodeIds = await syncSectionAnnotationsKnowledge({
      ...annotationSource,
      enqueueFollowups: !sync,
    });

    if (sync) {
      await runManualSourceFollowup({
        userId: bundle.userId,
        sourceType: "annotation",
        sourceId: annotationSource.sectionId,
        affectedNodeIds,
        hasContent: annotationSource.annotations.length > 0,
        reasonKey: `backfill:annotation:${annotationSource.sectionId}`,
      });
    }
  }

  for (const note of bundle.notes) {
    const affectedNodeIds = await syncNoteKnowledge(note, {
      enqueueFollowups: !sync,
    });

    if (sync) {
      const sourceType = resolveNoteBackedKnowledgeSourceType(note.sourceType);
      await runManualSourceFollowup({
        userId: bundle.userId,
        sourceType,
        sourceId: note.id,
        affectedNodeIds,
        hasContent: hasNoteContent(note),
        reasonKey: `backfill:${sourceType}:${note.id}`,
      });
    }
  }

  for (const conversation of bundle.conversations) {
    const affectedNodeIds = await syncConversationKnowledge({
      conversationId: conversation.id,
      userId: bundle.userId,
      messages: conversation.messages,
      enqueueFollowups: !sync,
    });

    if (sync) {
      await runManualSourceFollowup({
        userId: bundle.userId,
        sourceType: "conversation",
        sourceId: conversation.id,
        affectedNodeIds,
        hasContent: hasSourceTextContent(conversation.messages),
        reasonKey: `backfill:conversation:${conversation.id}`,
      });
    }
  }

  if (sync) {
    await runGrowthProjectionPipeline(bundle.userId);
  }
}

export async function runRuntimeBundlesBackfill(params: {
  bundles: RuntimeUserBundle[];
  sync: boolean;
  onUserStart?: (input: {
    bundle: RuntimeUserBundle;
    summary: RuntimeUserBundleSummary;
  }) => void | Promise<void>;
  onUserComplete?: (input: { bundle: RuntimeUserBundle }) => void | Promise<void>;
}): Promise<void> {
  for (const bundle of params.bundles) {
    const summary = summarizeRuntimeUserBundle(bundle);
    await params.onUserStart?.({
      bundle,
      summary,
    });

    await runRuntimeUserBackfill({
      bundle,
      sync: params.sync,
    });

    await params.onUserComplete?.({
      bundle,
    });
  }
}

async function countSourceRows(params: { userId: string; sourceType: string; sourceId: string }) {
  const [eventCountRow, evidenceCountRow] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(knowledgeEvidenceEvents)
      .where(
        and(
          eq(knowledgeEvidenceEvents.userId, params.userId),
          eq(knowledgeEvidenceEvents.sourceType, params.sourceType),
          eq(knowledgeEvidenceEvents.sourceId, params.sourceId),
        ),
      )
      .then((rows) => rows[0]),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(knowledgeEvidence)
      .where(
        and(
          eq(knowledgeEvidence.userId, params.userId),
          eq(knowledgeEvidence.sourceType, params.sourceType),
          eq(knowledgeEvidence.sourceId, params.sourceId),
        ),
      )
      .then((rows) => rows[0]),
  ]);

  return {
    events: eventCountRow?.count ?? 0,
    evidence: evidenceCountRow?.count ?? 0,
  };
}

export async function verifyRuntimeCourse(course: RuntimeTargetCourse): Promise<void> {
  const [sourceCounts, latestExtractRun, latestMergeRun] = await Promise.all([
    countSourceRows({
      userId: course.userId,
      sourceType: "course",
      sourceId: course.id,
    }),
    db.query.knowledgeGenerationRuns.findFirst({
      where: and(
        eq(knowledgeGenerationRuns.userId, course.userId),
        eq(knowledgeGenerationRuns.courseId, course.id),
        eq(knowledgeGenerationRuns.kind, "extract"),
      ),
      orderBy: desc(knowledgeGenerationRuns.createdAt),
    }),
    db.query.knowledgeGenerationRuns.findFirst({
      where: and(
        eq(knowledgeGenerationRuns.userId, course.userId),
        eq(knowledgeGenerationRuns.courseId, course.id),
        eq(knowledgeGenerationRuns.kind, "merge"),
      ),
      orderBy: desc(knowledgeGenerationRuns.createdAt),
    }),
  ]);

  assert(sourceCounts.events > 0, `course ${course.id} has no knowledge events`);
  assert(sourceCounts.evidence > 0, `course ${course.id} has no knowledge evidence`);
  assert(latestExtractRun?.status === "succeeded", `course ${course.id} extract run not succeeded`);
  assert(latestMergeRun?.status === "succeeded", `course ${course.id} merge run not succeeded`);
}

export async function verifyRuntimeKnowledgeSources(bundle: RuntimeUserBundle): Promise<void> {
  for (const sectionDocument of bundle.sectionDocuments) {
    if (!sectionDocument.plainText.trim()) {
      continue;
    }

    const counts = await countSourceRows({
      userId: bundle.userId,
      sourceType: "course_section",
      sourceId: sectionDocument.documentId,
    });

    assert(
      counts.events > 0 && counts.evidence > 0,
      `course section ${sectionDocument.documentId} missing knowledge rows`,
    );
  }

  for (const annotationSource of bundle.annotationSources) {
    if (annotationSource.annotations.length === 0) {
      continue;
    }

    const counts = await countSourceRows({
      userId: bundle.userId,
      sourceType: "annotation",
      sourceId: annotationSource.sectionId,
    });

    assert(
      counts.events > 0 && counts.evidence > 0,
      `annotation source ${annotationSource.sectionId} missing knowledge rows`,
    );
  }

  for (const note of bundle.notes) {
    if (!hasNoteContent(note)) {
      continue;
    }

    const sourceType = resolveNoteBackedKnowledgeSourceType(note.sourceType);
    const counts = await countSourceRows({
      userId: bundle.userId,
      sourceType,
      sourceId: note.id,
    });

    assert(
      counts.events > 0 && counts.evidence > 0,
      `note source ${sourceType}:${note.id} missing knowledge rows`,
    );
  }

  for (const conversation of bundle.conversations) {
    if (!hasSourceTextContent(conversation.messages)) {
      continue;
    }

    const counts = await countSourceRows({
      userId: bundle.userId,
      sourceType: "conversation",
      sourceId: conversation.id,
    });

    assert(
      counts.events > 0 && counts.evidence > 0,
      `conversation ${conversation.id} missing knowledge rows`,
    );
  }
}

export async function verifyRuntimeUser(userId: string): Promise<RuntimeUserVerificationSummary> {
  const [
    treeSnapshotRow,
    focusSnapshotRow,
    profileSnapshotRow,
    latestComposeRun,
    latestProjectionRun,
    latestInsightRun,
  ] = await Promise.all([
    db.query.userCareerTreeSnapshots.findFirst({
      where: and(
        eq(userCareerTreeSnapshots.userId, userId),
        eq(userCareerTreeSnapshots.isLatest, true),
      ),
      orderBy: desc(userCareerTreeSnapshots.createdAt),
    }),
    db.query.userFocusSnapshots.findFirst({
      where: and(eq(userFocusSnapshots.userId, userId), eq(userFocusSnapshots.isLatest, true)),
      orderBy: desc(userFocusSnapshots.createdAt),
    }),
    db.query.userProfileSnapshots.findFirst({
      where: and(eq(userProfileSnapshots.userId, userId), eq(userProfileSnapshots.isLatest, true)),
      orderBy: desc(userProfileSnapshots.createdAt),
    }),
    db.query.knowledgeGenerationRuns.findFirst({
      where: and(
        eq(knowledgeGenerationRuns.userId, userId),
        eq(knowledgeGenerationRuns.kind, "compose"),
      ),
      orderBy: desc(knowledgeGenerationRuns.createdAt),
    }),
    db.query.knowledgeGenerationRuns.findFirst({
      where: and(
        eq(knowledgeGenerationRuns.userId, userId),
        eq(knowledgeGenerationRuns.kind, "projection"),
      ),
      orderBy: desc(knowledgeGenerationRuns.createdAt),
    }),
    db.query.knowledgeGenerationRuns.findFirst({
      where: and(
        eq(knowledgeGenerationRuns.userId, userId),
        eq(knowledgeGenerationRuns.kind, "insight"),
      ),
      orderBy: desc(knowledgeGenerationRuns.createdAt),
    }),
  ]);

  assert(treeSnapshotRow, `user ${userId} missing latest career tree snapshot`);
  assert(focusSnapshotRow, `user ${userId} missing latest focus snapshot`);
  assert(profileSnapshotRow, `user ${userId} missing latest profile snapshot`);
  assert(latestComposeRun?.status === "succeeded", `user ${userId} compose run not succeeded`);
  assert(
    latestProjectionRun?.status === "succeeded",
    `user ${userId} projection run not succeeded`,
  );
  assert(latestInsightRun?.status === "succeeded", `user ${userId} insight run not succeeded`);

  const treeSnapshot = careerTreeSnapshotSchema.parse(treeSnapshotRow.payload);
  const focusSnapshot = focusSnapshotPayloadSchema.parse(focusSnapshotRow.payload);
  const profileSnapshot = profileSnapshotPayloadSchema.parse(profileSnapshotRow.payload);

  assert(treeSnapshot.status === "ready", `user ${userId} latest tree snapshot is not ready`);
  assert(
    treeSnapshot.trees.length >= 1 && treeSnapshot.trees.length <= 5,
    `user ${userId} tree count ${treeSnapshot.trees.length} is outside 1-5`,
  );
  assert(
    Boolean(focusSnapshot.treeTitle || focusSnapshot.node?.title),
    `user ${userId} focus snapshot missing title`,
  );
  assert(
    Boolean(profileSnapshot.currentDirection || profileSnapshot.focus),
    `user ${userId} profile snapshot missing direction and focus`,
  );

  const growthContext = await getUserGrowthContext(userId);
  assert(
    Boolean(
      growthContext.currentDirection || growthContext.currentFocus || growthContext.insights.length,
    ),
    `user ${userId} growth context is empty after runtime pipeline`,
  );

  return {
    userId,
    treeCount: treeSnapshot.trees.length,
    focusTitle: focusSnapshot.node?.title ?? focusSnapshot.treeTitle ?? null,
  };
}

export async function verifyRuntimeBundles(params: {
  targetCourses: RuntimeTargetCourse[];
  bundles: RuntimeUserBundle[];
  runBeforeVerify?: boolean;
  onRuntimeRunStart?: (input: { bundle: RuntimeUserBundle }) => void | Promise<void>;
  onCourseVerified?: (input: { course: RuntimeTargetCourse }) => void | Promise<void>;
  onUserVerified?: (input: RuntimeUserVerificationSummary) => void | Promise<void>;
}): Promise<void> {
  if (params.runBeforeVerify) {
    for (const bundle of params.bundles) {
      await params.onRuntimeRunStart?.({
        bundle,
      });

      await runRuntimeUserBackfill({
        bundle,
        sync: true,
      });
    }
  }

  for (const course of params.targetCourses) {
    await verifyRuntimeCourse(course);
    await params.onCourseVerified?.({
      course,
    });
  }

  for (const bundle of params.bundles) {
    await verifyRuntimeKnowledgeSources(bundle);
    const summary = await verifyRuntimeUser(bundle.userId);
    await params.onUserVerified?.(summary);
  }
}
