import { type DomainOutboxPayload, domainOutboxEvents } from "@/db";
import type { LearningEnrollmentExecutor } from "@/lib/learning/enrollments";

export const LEARNING_OUTBOX_TOPICS = {
  courseRevisionCreated: "learning.course_revision_created",
  sectionCompleted: "learning.section_completed",
} as const;

export type LearningOutboxTopic =
  (typeof LEARNING_OUTBOX_TOPICS)[keyof typeof LEARNING_OUTBOX_TOPICS];

export async function appendLearningOutboxEvent(
  executor: Pick<LearningEnrollmentExecutor, "insert">,
  input: {
    id?: string;
    topic: LearningOutboxTopic;
    aggregateType: "course_revision" | "learning_enrollment";
    aggregateId: string;
    payload: DomainOutboxPayload;
  },
): Promise<string> {
  const id = input.id ?? crypto.randomUUID();
  await executor.insert(domainOutboxEvents).values({
    id,
    topic: input.topic,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload,
  });
  return id;
}
