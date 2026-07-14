import { db, learningActivityEvents } from "@/db";
import type {
  LearningActivityEventType,
  LearningActivityMetadata,
} from "@/db/schema/learning-activity";

export type LearningActivityExecutor = Pick<typeof db, "insert">;

export interface AppendLearningActivityEventInput {
  id?: string;
  userId: string;
  courseId: string;
  enrollmentId: string;
  eventType: LearningActivityEventType;
  idempotencyKey: string;
  sectionNodeId?: string;
  metadata?: LearningActivityMetadata;
  occurredAt?: Date;
}

export async function appendLearningActivityEvent(
  input: AppendLearningActivityEventInput,
  executor: LearningActivityExecutor = db,
): Promise<void> {
  await executor
    .insert(learningActivityEvents)
    .values({
      id: input.id,
      userId: input.userId,
      courseId: input.courseId,
      enrollmentId: input.enrollmentId,
      eventType: input.eventType,
      idempotencyKey: input.idempotencyKey,
      sectionNodeId: input.sectionNodeId,
      metadata: input.metadata ?? {},
      occurredAt: input.occurredAt ?? new Date(),
    })
    .onConflictDoNothing({ target: learningActivityEvents.idempotencyKey });
}

export function buildLearningActivityKey(input: {
  userId: string;
  enrollmentId: string;
  eventType: LearningActivityEventType;
  discriminator?: string;
}): string {
  return [input.eventType, input.userId, input.enrollmentId, input.discriminator]
    .filter(Boolean)
    .join(":");
}
