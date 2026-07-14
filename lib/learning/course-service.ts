import { and, eq } from "drizzle-orm";
import { courseOutlineNodes, courseOutlineVersions, courseSections, courses, db } from "@/db";
import {
  type CoursePublicationRefreshResult,
  refreshPublishedCoursePublication,
} from "@/lib/learning/course-publication-service";
import { getOwnedCourse } from "@/lib/learning/course-repository";
import {
  buildCourseOutlineNodeValues,
  buildCourseOutlineVersionValues,
  computeCourseOutlineVersionHash,
} from "@/lib/learning/course-structure";
import { appendLearningOutboxEvent, LEARNING_OUTBOX_TOPICS } from "@/lib/learning/outbox";
import {
  buildChapterOutlineNodeKey,
  buildSectionOutlineNodeKey,
} from "@/lib/learning/outline-node-key";
import type { CourseOutline } from "./course-outline";

interface SaveCourseFromOutlineOptions {
  userId: string;
  outline: CourseOutline;
  courseId?: string;
}

export interface SaveCourseFromOutlineResult {
  courseId: string;
  publicationRefresh: CoursePublicationRefreshResult | null;
}

type CourseSaveTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface PreviousOutlineNode {
  nodeType: string;
  nodeKey: string;
  parentNodeKey: string | null;
  title: string;
  semanticId: string;
}

function normalizeSemanticTitle(value: string): string {
  return value.trim().toLocaleLowerCase("zh-CN").replace(/\s+/g, " ");
}

function buildSemanticIdsByNodeKey(
  outline: CourseOutline,
  previousNodes: PreviousOutlineNode[],
): Map<string, string> {
  const previousChaptersByTitle = new Map(
    previousNodes
      .filter((node) => node.nodeType === "chapter")
      .map((node) => [normalizeSemanticTitle(node.title), node] as const),
  );
  const previousNodesByKey = new Map(previousNodes.map((node) => [node.nodeKey, node]));
  const previousSectionsByPath = new Map(
    previousNodes
      .filter((node) => node.nodeType === "section" && node.parentNodeKey)
      .flatMap((node) => {
        const parent = node.parentNodeKey ? previousNodesByKey.get(node.parentNodeKey) : null;
        return parent
          ? [
              [
                `${normalizeSemanticTitle(parent.title)}:${normalizeSemanticTitle(node.title)}`,
                node,
              ] as const,
            ]
          : [];
      }),
  );
  const semanticIds = new Map<string, string>();

  outline.chapters.forEach((chapter, chapterIndex) => {
    const chapterKey = buildChapterOutlineNodeKey(chapterIndex);
    const chapterTitle = normalizeSemanticTitle(chapter.title);
    const previousChapter = previousChaptersByTitle.get(chapterTitle);
    if (previousChapter) semanticIds.set(chapterKey, previousChapter.semanticId);

    chapter.sections.forEach((section, sectionIndex) => {
      const previousSection = previousSectionsByPath.get(
        `${chapterTitle}:${normalizeSemanticTitle(section.title)}`,
      );
      if (previousSection) {
        semanticIds.set(
          buildSectionOutlineNodeKey(chapterIndex, sectionIndex),
          previousSection.semanticId,
        );
      }
    });
  });

  return semanticIds;
}

async function createCourseRevisionStructure(params: {
  tx: CourseSaveTransaction;
  courseId: string;
  outlineVersionId: string;
  outline: CourseOutline;
  previousNodes: PreviousOutlineNode[];
}) {
  const { tx, courseId, outlineVersionId, outline, previousNodes } = params;

  const outlineNodes = buildCourseOutlineNodeValues({
    courseId,
    outlineVersionId,
    outline,
    semanticIdsByNodeKey: buildSemanticIdsByNodeKey(outline, previousNodes),
  });

  const persistedNodes =
    outlineNodes.length > 0
      ? await tx.insert(courseOutlineNodes).values(outlineNodes).returning({
          id: courseOutlineNodes.id,
          nodeType: courseOutlineNodes.nodeType,
          nodeKey: courseOutlineNodes.nodeKey,
          title: courseOutlineNodes.title,
        })
      : [];
  const sectionDocuments = persistedNodes
    .filter((node) => node.nodeType === "section")
    .map((node) => ({
      title: node.title,
      courseId,
      outlineVersionId,
      outlineNodeId: node.id,
      outlineNodeKey: node.nodeKey,
      contentMarkdown: null,
      plainText: null,
    }));

  if (sectionDocuments.length > 0) {
    await tx.insert(courseSections).values(sectionDocuments);
  }
}

export async function saveCourseFromOutline({
  userId,
  outline,
  courseId,
}: SaveCourseFromOutlineOptions): Promise<SaveCourseFromOutlineResult> {
  const result = await db.transaction(async (tx) => {
    const now = new Date();
    const outlineVersionHash = computeCourseOutlineVersionHash(outline);
    const courseValues = {
      userId,
      title: outline.title,
      description: outline.description ?? null,
      difficulty: outline.difficulty,
      estimatedMinutes: null,
      updatedAt: now,
    };

    let persistedCourseId = courseId;

    if (persistedCourseId) {
      const existingCourse = await getOwnedCourse(persistedCourseId, userId, tx);
      if (!existingCourse) {
        throw new Error("课程不存在或无权访问");
      }

      await tx.update(courses).set(courseValues).where(eq(courses.id, persistedCourseId));
    } else {
      const [createdCourse] = await tx
        .insert(courses)
        .values(courseValues)
        .returning({ id: courses.id });

      persistedCourseId = createdCourse.id;
    }

    const previousOutlineVersion = await tx.query.courseOutlineVersions.findFirst({
      where: and(
        eq(courseOutlineVersions.courseId, persistedCourseId),
        eq(courseOutlineVersions.isLatest, true),
      ),
    });
    const previousNodes = previousOutlineVersion
      ? await tx
          .select({
            nodeType: courseOutlineNodes.nodeType,
            nodeKey: courseOutlineNodes.nodeKey,
            parentNodeKey: courseOutlineNodes.parentNodeKey,
            title: courseOutlineNodes.title,
            semanticId: courseOutlineNodes.semanticId,
          })
          .from(courseOutlineNodes)
          .where(eq(courseOutlineNodes.outlineVersionId, previousOutlineVersion.id))
      : [];

    const [existingOutlineVersion] = await tx
      .select({ id: courseOutlineVersions.id, isLatest: courseOutlineVersions.isLatest })
      .from(courseOutlineVersions)
      .where(
        and(
          eq(courseOutlineVersions.courseId, persistedCourseId),
          eq(courseOutlineVersions.versionHash, outlineVersionHash),
        ),
      )
      .limit(1);

    if (existingOutlineVersion) {
      if (!existingOutlineVersion.isLatest) {
        await tx
          .update(courseOutlineVersions)
          .set({ isLatest: false, updatedAt: now })
          .where(eq(courseOutlineVersions.courseId, persistedCourseId));

        await tx
          .update(courseOutlineVersions)
          .set({ isLatest: true, updatedAt: now })
          .where(eq(courseOutlineVersions.id, existingOutlineVersion.id));

        await appendLearningOutboxEvent(tx, {
          topic: LEARNING_OUTBOX_TOPICS.courseRevisionCreated,
          aggregateType: "course_revision",
          aggregateId: existingOutlineVersion.id,
          payload: {
            userId,
            courseId: persistedCourseId,
            outlineVersionId: existingOutlineVersion.id,
            outline,
          },
        });
      }

      const publicationRefresh = await refreshPublishedCoursePublication({
        courseId: persistedCourseId,
        userId,
        executor: tx,
      });

      return { courseId: persistedCourseId, publicationRefresh };
    }

    await tx
      .update(courseOutlineVersions)
      .set({ isLatest: false, updatedAt: now })
      .where(eq(courseOutlineVersions.courseId, persistedCourseId));

    const [outlineVersion] = await tx
      .insert(courseOutlineVersions)
      .values(
        buildCourseOutlineVersionValues({
          courseId: persistedCourseId,
          outline,
          versionHash: outlineVersionHash,
          updatedAt: now,
        }),
      )
      .onConflictDoNothing({
        target: [courseOutlineVersions.courseId, courseOutlineVersions.versionHash],
      })
      .returning({ id: courseOutlineVersions.id });

    if (!outlineVersion) {
      const [racedOutlineVersion] = await tx
        .select({ id: courseOutlineVersions.id, isLatest: courseOutlineVersions.isLatest })
        .from(courseOutlineVersions)
        .where(
          and(
            eq(courseOutlineVersions.courseId, persistedCourseId),
            eq(courseOutlineVersions.versionHash, outlineVersionHash),
          ),
        )
        .limit(1);

      if (!racedOutlineVersion) {
        throw new Error("Course outline version conflict without persisted row");
      }

      if (!racedOutlineVersion.isLatest) {
        await tx
          .update(courseOutlineVersions)
          .set({ isLatest: true, updatedAt: now })
          .where(eq(courseOutlineVersions.id, racedOutlineVersion.id));

        await appendLearningOutboxEvent(tx, {
          topic: LEARNING_OUTBOX_TOPICS.courseRevisionCreated,
          aggregateType: "course_revision",
          aggregateId: racedOutlineVersion.id,
          payload: {
            userId,
            courseId: persistedCourseId,
            outlineVersionId: racedOutlineVersion.id,
            outline,
          },
        });
      }

      const publicationRefresh = await refreshPublishedCoursePublication({
        courseId: persistedCourseId,
        userId,
        executor: tx,
      });

      return { courseId: persistedCourseId, publicationRefresh };
    }

    await createCourseRevisionStructure({
      tx,
      courseId: persistedCourseId,
      outlineVersionId: outlineVersion.id,
      outline,
      previousNodes,
    });

    await appendLearningOutboxEvent(tx, {
      topic: LEARNING_OUTBOX_TOPICS.courseRevisionCreated,
      aggregateType: "course_revision",
      aggregateId: outlineVersion.id,
      payload: {
        userId,
        courseId: persistedCourseId,
        outlineVersionId: outlineVersion.id,
        outline,
      },
    });

    const publicationRefresh = await refreshPublishedCoursePublication({
      courseId: persistedCourseId,
      userId,
      executor: tx,
    });

    return { courseId: persistedCourseId, publicationRefresh };
  });

  return result;
}
