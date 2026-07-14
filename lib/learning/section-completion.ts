import { eq } from "drizzle-orm";
import { db, learningEnrollments, learningSectionCompletions } from "@/db";
import type { LearningActivityMetadata } from "@/db/schema/learning-activity";
import {
  appendLearningActivityEvent,
  buildLearningActivityKey,
} from "@/lib/learning/activity-events";
import {
  ensureLearningEnrollment,
  type LearningEnrollmentIdentity,
  loadEnrollmentSectionIds,
} from "@/lib/learning/enrollments";
import { appendLearningOutboxEvent, LEARNING_OUTBOX_TOPICS } from "@/lib/learning/outbox";

interface CompletionSection {
  id: string;
  title: string;
  index: number;
}

interface CompletionChapter {
  id?: string;
  title: string;
  index: number;
}

export interface CompleteLearningSectionInput {
  enrollment: LearningEnrollmentIdentity;
  outlineVersionId: string;
  sourceVersionHash: string;
  courseTitle: string;
  section: CompletionSection;
  chapter: CompletionChapter;
  allSectionIds: string[];
  activitySource: NonNullable<LearningActivityMetadata["source"]>;
}

export interface LearningSectionCompletionTransition {
  newSectionCompleted: boolean;
  completedSectionIds: string[];
  courseCompleted: boolean;
}

export async function completeLearningSection(
  input: CompleteLearningSectionInput,
): Promise<LearningSectionCompletionTransition> {
  return db.transaction(async (tx) => {
    const enrollment = await ensureLearningEnrollment(tx, input.enrollment);
    const existingSectionIds = await loadEnrollmentSectionIds(tx, enrollment.id);
    if (existingSectionIds.includes(input.section.id)) {
      return {
        newSectionCompleted: false,
        completedSectionIds: existingSectionIds,
        courseCompleted: enrollment.completedAt !== null,
      };
    }

    const now = new Date();
    await tx.insert(learningSectionCompletions).values({
      enrollmentId: enrollment.id,
      sectionId: input.section.id,
      completedAt: now,
    });
    const completedSectionIds = [...existingSectionIds, input.section.id];
    const completedSet = new Set(completedSectionIds);
    const courseCompleted =
      input.allSectionIds.length > 0 &&
      input.allSectionIds.every((sectionId) => completedSet.has(sectionId));

    await tx
      .update(learningEnrollments)
      .set({
        startedAt: enrollment.startedAt ?? now,
        completedAt: courseCompleted ? (enrollment.completedAt ?? now) : null,
        updatedAt: now,
      })
      .where(eq(learningEnrollments.id, enrollment.id));

    if (!enrollment.startedAt) {
      await appendLearningActivityEvent(
        {
          userId: input.enrollment.userId,
          courseId: input.enrollment.courseId,
          enrollmentId: enrollment.id,
          eventType: "course_started",
          idempotencyKey: buildLearningActivityKey({
            userId: input.enrollment.userId,
            enrollmentId: enrollment.id,
            eventType: "course_started",
          }),
          metadata: { source: input.activitySource },
          occurredAt: now,
        },
        tx,
      );
    }

    const activityEventId = crypto.randomUUID();
    await appendLearningActivityEvent(
      {
        id: activityEventId,
        userId: input.enrollment.userId,
        courseId: input.enrollment.courseId,
        enrollmentId: enrollment.id,
        eventType: "section_completed",
        sectionNodeId: input.section.id,
        idempotencyKey: buildLearningActivityKey({
          userId: input.enrollment.userId,
          enrollmentId: enrollment.id,
          eventType: "section_completed",
          discriminator: input.section.id,
        }),
        metadata: {
          chapterIndex: input.chapter.index,
          sectionIndex: input.section.index,
          completedSectionCount: completedSectionIds.length,
          totalSectionCount: input.allSectionIds.length,
          source: input.activitySource,
        },
        occurredAt: now,
      },
      tx,
    );

    if (courseCompleted && !enrollment.completedAt) {
      await appendLearningActivityEvent(
        {
          userId: input.enrollment.userId,
          courseId: input.enrollment.courseId,
          enrollmentId: enrollment.id,
          eventType: "course_completed",
          idempotencyKey: buildLearningActivityKey({
            userId: input.enrollment.userId,
            enrollmentId: enrollment.id,
            eventType: "course_completed",
          }),
          metadata: {
            completedSectionCount: completedSectionIds.length,
            totalSectionCount: input.allSectionIds.length,
            source: input.activitySource,
          },
          occurredAt: now,
        },
        tx,
      );
    }

    await appendLearningOutboxEvent(tx, {
      topic: LEARNING_OUTBOX_TOPICS.sectionCompleted,
      aggregateType: "learning_enrollment",
      aggregateId: enrollment.id,
      payload: {
        activityEventId,
        userId: input.enrollment.userId,
        courseId: input.enrollment.courseId,
        publicationId: input.enrollment.publicationId,
        snapshotId: input.enrollment.snapshotId,
        outlineVersionId: input.outlineVersionId,
        sourceVersionHash: input.sourceVersionHash,
        courseTitle: input.courseTitle,
        sectionId: input.section.id,
        sectionTitle: input.section.title,
        chapterId: input.chapter.id,
        chapterTitle: input.chapter.title,
        completedSectionCount: completedSectionIds.length,
        totalSectionCount: input.allSectionIds.length,
      },
    });

    return { newSectionCompleted: true, completedSectionIds, courseCompleted };
  });
}
