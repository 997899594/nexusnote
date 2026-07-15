import { z } from "zod";
import { env } from "@/config/env";
import type { LearningActivityEventType } from "@/db/schema/learning-activity";

export const ProductLearningActivityPayloadSchema = z.object({
  eventId: z.string().uuid(),
  userId: z.string().uuid(),
  courseId: z.string().uuid(),
  enrollmentId: z.string().uuid().optional(),
  eventType: z.enum([
    "course_generated",
    "course_opened",
    "course_started",
    "section_completed",
    "course_completed",
  ] satisfies [LearningActivityEventType, ...LearningActivityEventType[]]),
  sectionNodeId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  occurredAt: z.string().datetime(),
});

export type ProductLearningActivityPayload = z.infer<typeof ProductLearningActivityPayloadSchema>;

export async function mirrorLearningActivityToPostHog(
  payload: ProductLearningActivityPayload,
): Promise<"captured" | "skipped"> {
  if (!env.POSTHOG_PROJECT_KEY) {
    return "skipped";
  }

  const endpoint = new URL("/i/v0/e/", env.POSTHOG_HOST);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: env.POSTHOG_PROJECT_KEY,
      event: `learning.${payload.eventType}`,
      uuid: payload.eventId,
      timestamp: payload.occurredAt,
      properties: {
        ...payload.metadata,
        distinct_id: payload.userId,
        event_id: payload.eventId,
        course_id: payload.courseId,
        enrollment_id: payload.enrollmentId ?? null,
        section_node_id: payload.sectionNodeId ?? null,
      },
    }),
    signal: AbortSignal.timeout(5_000),
  });

  if (!response.ok) {
    throw new Error(`PostHog capture failed with HTTP ${response.status}`);
  }

  return "captured";
}
