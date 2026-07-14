import "server-only";

import { and, eq, gt, sql } from "drizzle-orm";
import { db, learningActivityEvents, learningEnrollments } from "@/db";

export interface LearningInsightStats {
  activeDays: number;
  completedSections: number;
  resumedSessions: number;
  completionRate: number;
  completedCourses: number;
  startedCourses: number;
}

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

export async function getLearningInsightStats(
  userId: string,
  windowStart: Date,
): Promise<LearningInsightStats> {
  const [activityRows, enrollmentRows] = await Promise.all([
    db
      .select({
        activeDays: sql<number>`count(distinct date(${learningActivityEvents.occurredAt}))`,
        completedSections: sql<number>`count(*) filter (where ${learningActivityEvents.eventType} = 'section_completed')`,
        openedSessions: sql<number>`count(*) filter (where ${learningActivityEvents.eventType} = 'course_opened')`,
        openedEnrollments: sql<number>`count(distinct ${learningActivityEvents.enrollmentId}) filter (where ${learningActivityEvents.eventType} = 'course_opened')`,
      })
      .from(learningActivityEvents)
      .where(
        and(
          eq(learningActivityEvents.userId, userId),
          gt(learningActivityEvents.occurredAt, windowStart),
        ),
      ),
    db
      .select({
        startedCourses: sql<number>`count(*) filter (where ${learningEnrollments.startedAt} is not null)`,
        completedCourses: sql<number>`count(*) filter (where ${learningEnrollments.completedAt} is not null)`,
      })
      .from(learningEnrollments)
      .where(eq(learningEnrollments.userId, userId)),
  ]);

  const activity = activityRows[0];
  const enrollments = enrollmentRows[0];
  const startedCourses = toNumber(enrollments?.startedCourses);
  const completedCourses = toNumber(enrollments?.completedCourses);
  const openedSessions = toNumber(activity?.openedSessions);
  const openedEnrollments = toNumber(activity?.openedEnrollments);

  return {
    activeDays: toNumber(activity?.activeDays),
    completedSections: toNumber(activity?.completedSections),
    resumedSessions: Math.max(0, openedSessions - openedEnrollments),
    completionRate: startedCourses > 0 ? Math.round((completedCourses / startedCourses) * 100) : 0,
    completedCourses,
    startedCourses,
  };
}
