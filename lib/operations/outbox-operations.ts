import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { env } from "@/config/env";
import { db, domainOutboxEvents } from "@/db";
import { LEARNING_OUTBOX_TOPICS } from "@/lib/learning/outbox";

const CRITICAL_OUTBOX_TOPICS = [
  LEARNING_OUTBOX_TOPICS.courseRevisionCreated,
  LEARNING_OUTBOX_TOPICS.sectionCompleted,
  LEARNING_OUTBOX_TOPICS.activityRecorded,
] as const;

const ANALYTICS_OUTBOX_TOPICS = [LEARNING_OUTBOX_TOPICS.analyticsLearningActivityRecorded] as const;

type OutboxDatabaseExecutor = Pick<typeof db, "execute">;

export interface OutboxOperationalSnapshot {
  criticalPendingCount: number;
  criticalOldestPendingAgeSeconds: number;
  criticalDeadLetterCount: number;
  analyticsDeadLetterCount: number;
  maxPendingAgeSeconds: number;
}

interface OutboxSnapshotRow extends Record<string, unknown> {
  critical_pending_count: number | string;
  critical_oldest_pending_age_seconds: number | string | null;
  critical_dead_letter_count: number | string;
  analytics_dead_letter_count: number | string;
}

export async function getOutboxOperationalSnapshot(
  executor: OutboxDatabaseExecutor = db,
): Promise<OutboxOperationalSnapshot> {
  const [row] = await executor.execute<OutboxSnapshotRow>(sql`
    select
      count(*) filter (
        where topic in (${sql.join(
          CRITICAL_OUTBOX_TOPICS.map((topic) => sql`${topic}`),
          sql`, `,
        )})
          and processed_at is null
          and dead_lettered_at is null
      ) as critical_pending_count,
      coalesce(
        extract(epoch from now() - min(created_at) filter (
          where topic in (${sql.join(
            CRITICAL_OUTBOX_TOPICS.map((topic) => sql`${topic}`),
            sql`, `,
          )})
            and processed_at is null
            and dead_lettered_at is null
        )),
        0
      ) as critical_oldest_pending_age_seconds,
      count(*) filter (
        where topic in (${sql.join(
          CRITICAL_OUTBOX_TOPICS.map((topic) => sql`${topic}`),
          sql`, `,
        )})
          and dead_lettered_at is not null
      ) as critical_dead_letter_count,
      count(*) filter (
        where topic in (${sql.join(
          ANALYTICS_OUTBOX_TOPICS.map((topic) => sql`${topic}`),
          sql`, `,
        )})
          and dead_lettered_at is not null
      ) as analytics_dead_letter_count
    from domain_outbox_events
  `);

  return {
    criticalPendingCount: Number(row?.critical_pending_count ?? 0),
    criticalOldestPendingAgeSeconds: Math.round(
      Number(row?.critical_oldest_pending_age_seconds ?? 0),
    ),
    criticalDeadLetterCount: Number(row?.critical_dead_letter_count ?? 0),
    analyticsDeadLetterCount: Number(row?.analytics_dead_letter_count ?? 0),
    maxPendingAgeSeconds: env.OUTBOX_SLO_MAX_PENDING_AGE_SECONDS,
  };
}

export async function assertOutboxOperational(
  executor: OutboxDatabaseExecutor = db,
): Promise<OutboxOperationalSnapshot> {
  const snapshot = await getOutboxOperationalSnapshot(executor);
  if (snapshot.criticalDeadLetterCount > 0) {
    throw new Error(`Critical outbox has ${snapshot.criticalDeadLetterCount} dead-letter event(s)`);
  }
  if (snapshot.criticalOldestPendingAgeSeconds > snapshot.maxPendingAgeSeconds) {
    throw new Error(
      `Critical outbox lag ${snapshot.criticalOldestPendingAgeSeconds}s exceeds ${snapshot.maxPendingAgeSeconds}s`,
    );
  }
  return snapshot;
}

export async function replayDeadLetterEvent(eventId: string): Promise<boolean> {
  const [replayed] = await db
    .update(domainOutboxEvents)
    .set({
      processedAt: null,
      deadLetteredAt: null,
      lastAttemptAt: null,
      attemptCount: 0,
      replayCount: sql`${domainOutboxEvents.replayCount} + 1`,
      lastError: null,
      availableAt: new Date(),
    })
    .where(
      and(
        eq(domainOutboxEvents.id, eventId),
        isNull(domainOutboxEvents.processedAt),
        isNotNull(domainOutboxEvents.deadLetteredAt),
        inArray(domainOutboxEvents.topic, [...CRITICAL_OUTBOX_TOPICS, ...ANALYTICS_OUTBOX_TOPICS]),
      ),
    )
    .returning({ id: domainOutboxEvents.id });

  return Boolean(replayed);
}
