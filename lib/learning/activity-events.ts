import { learningActivityEvents } from "@/db";
import type {
  LearningActivityEventType,
  LearningActivityMetadata,
} from "@/db/schema/learning-activity";
import type { LearningEnrollmentExecutor } from "@/lib/learning/enrollments";
import { appendLearningOutboxEvent, LEARNING_OUTBOX_TOPICS } from "@/lib/learning/outbox";

export type LearningActivityExecutor = Pick<LearningEnrollmentExecutor, "insert">;

export interface AppendLearningActivityEventInput {
  id?: string;
  userId: string;
  courseId: string;
  enrollmentId?: string;
  eventType: LearningActivityEventType;
  idempotencyKey: string;
  sectionNodeId?: string;
  metadata?: LearningActivityMetadata;
  occurredAt?: Date;
}

export async function appendLearningActivityEvent(
  input: AppendLearningActivityEventInput,
  executor: LearningActivityExecutor,
): Promise<string | null> {
  const eventId = input.id ?? crypto.randomUUID();
  const occurredAt = input.occurredAt ?? new Date();
  const [inserted] = await executor
    .insert(learningActivityEvents)
    .values({
      id: eventId,
      userId: input.userId,
      courseId: input.courseId,
      enrollmentId: input.enrollmentId,
      eventType: input.eventType,
      idempotencyKey: input.idempotencyKey,
      sectionNodeId: input.sectionNodeId,
      metadata: input.metadata ?? {},
      occurredAt,
    })
    .onConflictDoNothing({ target: learningActivityEvents.idempotencyKey })
    .returning({ id: learningActivityEvents.id });

  if (!inserted) {
    return null;
  }

  await appendLearningOutboxEvent(executor, {
    topic: LEARNING_OUTBOX_TOPICS.activityRecorded,
    aggregateType: "learning_activity",
    aggregateId: eventId,
    payload: {
      eventId,
      userId: input.userId,
      courseId: input.courseId,
      enrollmentId: input.enrollmentId,
      eventType: input.eventType,
      sectionNodeId: input.sectionNodeId,
      metadata: input.metadata ?? {},
      occurredAt: occurredAt.toISOString(),
    },
  });

  return eventId;
}

export function buildLearningActivityKey(input: {
  userId: string;
  enrollmentId?: string;
  courseId?: string;
  eventType: LearningActivityEventType;
  discriminator?: string;
}): string {
  const aggregateId = input.enrollmentId ?? input.courseId;
  if (!aggregateId) {
    throw new Error("Learning activity key requires an enrollment or course id");
  }

  return [input.eventType, input.userId, aggregateId, input.discriminator]
    .filter(Boolean)
    .join(":");
}
