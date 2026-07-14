import { and, eq } from "drizzle-orm";
import { db, type LearningSourceType, learningEnrollments, learningSectionCompletions } from "@/db";

export type LearningEnrollmentExecutor = Pick<typeof db, "insert" | "select" | "update">;

export interface LearningProgressSnapshot {
  enrollmentId: string;
  completedSectionIds: string[];
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
}

interface LearningEnrollmentIdentityBase {
  userId: string;
  courseId: string;
}

export type LearningEnrollmentIdentity = LearningEnrollmentIdentityBase &
  (
    | {
        sourceType: Extract<LearningSourceType, "course_revision">;
        outlineVersionId: string;
        publicationId?: never;
        snapshotId?: never;
      }
    | {
        sourceType: Extract<LearningSourceType, "publication_snapshot">;
        outlineVersionId?: never;
        publicationId: string;
        snapshotId: string;
      }
  );

function identityCondition(identity: LearningEnrollmentIdentity) {
  return identity.sourceType === "course_revision"
    ? and(
        eq(learningEnrollments.userId, identity.userId),
        eq(learningEnrollments.outlineVersionId, identity.outlineVersionId),
      )
    : and(
        eq(learningEnrollments.userId, identity.userId),
        eq(learningEnrollments.snapshotId, identity.snapshotId),
      );
}

export async function ensureLearningEnrollment(
  executor: LearningEnrollmentExecutor,
  identity: LearningEnrollmentIdentity,
) {
  const conflictTarget =
    identity.sourceType === "course_revision"
      ? [learningEnrollments.userId, learningEnrollments.outlineVersionId]
      : [learningEnrollments.userId, learningEnrollments.snapshotId];

  await executor
    .insert(learningEnrollments)
    .values({
      userId: identity.userId,
      courseId: identity.courseId,
      sourceType: identity.sourceType,
      outlineVersionId: identity.outlineVersionId,
      publicationId: identity.publicationId,
      snapshotId: identity.snapshotId,
    })
    .onConflictDoNothing({ target: conflictTarget });

  const [enrollment] = await executor
    .select()
    .from(learningEnrollments)
    .where(identityCondition(identity))
    .limit(1)
    .for("update");

  if (!enrollment) {
    throw new Error("Learning enrollment is unavailable.");
  }

  return enrollment;
}

export async function loadLearningProgress(
  identity: LearningEnrollmentIdentity,
): Promise<LearningProgressSnapshot | null> {
  const [enrollment] = await db
    .select()
    .from(learningEnrollments)
    .where(identityCondition(identity))
    .limit(1);

  if (!enrollment) return null;

  const completions = await db
    .select({ sectionId: learningSectionCompletions.sectionId })
    .from(learningSectionCompletions)
    .where(eq(learningSectionCompletions.enrollmentId, enrollment.id));

  return {
    enrollmentId: enrollment.id,
    completedSectionIds: completions.map((completion) => completion.sectionId),
    startedAt: enrollment.startedAt,
    completedAt: enrollment.completedAt,
    updatedAt: enrollment.updatedAt,
  };
}

export async function loadEnrollmentSectionIds(
  executor: Pick<typeof db, "select">,
  enrollmentId: string,
): Promise<string[]> {
  const rows = await executor
    .select({ sectionId: learningSectionCompletions.sectionId })
    .from(learningSectionCompletions)
    .where(eq(learningSectionCompletions.enrollmentId, enrollmentId));
  return rows.map((row) => row.sectionId);
}
