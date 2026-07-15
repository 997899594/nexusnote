import { and, asc, inArray, isNull, lte } from "drizzle-orm";
import { db, domainOutboxEvents } from "@/db";

export async function listPendingOutboxEventIds(
  topics: readonly string[],
  limit: number,
): Promise<string[]> {
  const events = await db
    .select({ id: domainOutboxEvents.id })
    .from(domainOutboxEvents)
    .where(
      and(
        inArray(domainOutboxEvents.topic, [...topics]),
        isNull(domainOutboxEvents.processedAt),
        isNull(domainOutboxEvents.deadLetteredAt),
        lte(domainOutboxEvents.availableAt, new Date()),
      ),
    )
    .orderBy(asc(domainOutboxEvents.createdAt))
    .limit(limit);

  return events.map((event) => event.id);
}
