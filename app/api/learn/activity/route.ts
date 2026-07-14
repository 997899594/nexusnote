import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db, learningEnrollments } from "@/db";
import { parseJsonBodyAs, withAuth } from "@/lib/api";
import { revalidateCourseProgressViews } from "@/lib/cache/domain-events";
import {
  appendLearningActivityEvent,
  buildLearningActivityKey,
} from "@/lib/learning/activity-events";
import { getOwnedCourseWithOutline } from "@/lib/learning/course-repository";
import { ensureLearningEnrollment } from "@/lib/learning/enrollments";

const RequestSchema = z.object({
  courseId: z.string().uuid(),
  activityId: z.string().uuid(),
});

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const { courseId, activityId } = await parseJsonBodyAs(request, RequestSchema);
  const course = await getOwnedCourseWithOutline(courseId, userId);

  if (!course) {
    return Response.json({ ok: false }, { status: 404 });
  }

  const started = await db.transaction(async (tx) => {
    const enrollment = await ensureLearningEnrollment(tx, {
      userId,
      courseId,
      sourceType: "course_revision",
      outlineVersionId: course.outlineVersionId,
    });

    const now = new Date();
    const isFirstOpen = enrollment.startedAt === null;

    if (isFirstOpen) {
      await tx
        .update(learningEnrollments)
        .set({ startedAt: now, updatedAt: now })
        .where(eq(learningEnrollments.id, enrollment.id));

      await appendLearningActivityEvent(
        {
          userId,
          courseId,
          enrollmentId: enrollment.id,
          eventType: "course_started",
          idempotencyKey: buildLearningActivityKey({
            userId,
            enrollmentId: enrollment.id,
            eventType: "course_started",
          }),
          metadata: { source: "course_reader" },
          occurredAt: now,
        },
        tx,
      );
    }

    await appendLearningActivityEvent(
      {
        userId,
        courseId,
        enrollmentId: enrollment.id,
        eventType: "course_opened",
        idempotencyKey: buildLearningActivityKey({
          userId,
          enrollmentId: enrollment.id,
          eventType: "course_opened",
          discriminator: activityId,
        }),
        metadata: { source: "course_reader" },
        occurredAt: now,
      },
      tx,
    );

    return isFirstOpen;
  });

  revalidateCourseProgressViews(userId, courseId);
  return Response.json({ ok: true, started });
});
