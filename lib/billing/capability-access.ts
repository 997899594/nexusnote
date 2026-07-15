import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { aiCapabilityUsageEvents, db, productAccessGrants, userEntitlements, users } from "@/db";
import {
  AI_CAPABILITIES,
  type AICapability,
  FREE_COURSE_GENERATION_LIFETIME_LIMIT,
  FREE_RESEARCH_WEEKLY_LIMIT,
} from "./capabilities";
import { CapabilityAllowanceExceededError } from "./capability-errors";

type CapabilityExecutor = Pick<typeof db, "execute">;

interface CapabilityPeriodRow extends Record<string, unknown> {
  period_start: Date;
  period_end: Date;
}

interface CapabilityUsageCountRow extends Record<string, unknown> {
  used_count: number | string;
}

export interface CapabilityAllowance {
  capability: AICapability;
  allowed: boolean;
  unlimited: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  periodStart: Date | null;
  periodEnd: Date | null;
}

const METERED_CAPABILITY_LIMITS = {
  [AI_CAPABILITIES.research]: FREE_RESEARCH_WEEKLY_LIMIT,
  [AI_CAPABILITIES.courseGeneration]: FREE_COURSE_GENERATION_LIFETIME_LIMIT,
} as const;

function getMeteredLimit(capability: AICapability): number | null {
  return capability in METERED_CAPABILITY_LIMITS
    ? METERED_CAPABILITY_LIMITS[capability as keyof typeof METERED_CAPABILITY_LIMITS]
    : null;
}

async function getCapabilityPeriod(
  executor: CapabilityExecutor,
  capability: AICapability,
): Promise<{ periodStart: Date; periodEnd: Date }> {
  if (capability === AI_CAPABILITIES.courseGeneration) {
    return {
      periodStart: new Date("2000-01-01T00:00:00.000Z"),
      periodEnd: new Date("9999-12-31T23:59:59.999Z"),
    };
  }

  const [period] = await executor.execute<CapabilityPeriodRow>(sql`
    select
      date_trunc('week', now() at time zone 'Asia/Shanghai')
        at time zone 'Asia/Shanghai' as period_start,
      (date_trunc('week', now() at time zone 'Asia/Shanghai') + interval '7 days')
        at time zone 'Asia/Shanghai' as period_end
  `);
  if (!period) throw new Error("Failed to resolve capability usage period");
  return { periodStart: period.period_start, periodEnd: period.period_end };
}

export async function getActiveProductAccessGrant(userId: string) {
  const [row] = await db
    .select({ grant: productAccessGrants })
    .from(users)
    .innerJoin(productAccessGrants, sql`${productAccessGrants.email} = lower(${users.email})`)
    .where(
      and(
        eq(users.id, userId),
        lte(productAccessGrants.startsAt, new Date()),
        isNull(productAccessGrants.revokedAt),
        or(isNull(productAccessGrants.expiresAt), gt(productAccessGrants.expiresAt, new Date())),
      ),
    )
    .limit(1);
  return row?.grant ?? null;
}

export async function hasUnlimitedAICapability(
  userId: string,
  capability: AICapability,
  executor: CapabilityExecutor = db,
): Promise<boolean> {
  const [row] = await executor.execute<{ allowed: boolean } & Record<string, unknown>>(sql`
    select (
      exists (
        select 1
        from ${userEntitlements}
        where ${userEntitlements.userId} = ${userId}
          and ${userEntitlements.revokedAt} is null
          and ${userEntitlements.expiresAt} > now()
      )
      or exists (
        select 1
        from ${users}
        join ${productAccessGrants}
          on ${productAccessGrants.email} = lower(${users.email})
        where ${users.id} = ${userId}
          and ${productAccessGrants.startsAt} <= now()
          and ${productAccessGrants.revokedAt} is null
          and (
            ${productAccessGrants.expiresAt} is null
            or ${productAccessGrants.expiresAt} > now()
          )
          and ${productAccessGrants.capabilities} @> ${JSON.stringify([capability])}::jsonb
      )
    ) as allowed
  `);
  return row?.allowed === true;
}

async function countCapabilityUsage(
  executor: CapabilityExecutor,
  userId: string,
  capability: AICapability,
  periodStart: Date,
): Promise<number> {
  const [row] = await executor.execute<CapabilityUsageCountRow>(sql`
    select count(*)::integer as used_count
    from ${aiCapabilityUsageEvents}
    where ${aiCapabilityUsageEvents.userId} = ${userId}
      and ${aiCapabilityUsageEvents.capability} = ${capability}
      and ${aiCapabilityUsageEvents.periodStart} = ${periodStart}
      and ${aiCapabilityUsageEvents.status} = 'consumed'
  `);
  return Number(row?.used_count ?? 0);
}

function buildUnlimitedAllowance(capability: AICapability): CapabilityAllowance {
  return {
    capability,
    allowed: true,
    unlimited: true,
    limit: null,
    used: 0,
    remaining: null,
    periodStart: null,
    periodEnd: null,
  };
}

export async function getCapabilityAllowance(
  userId: string,
  capability: AICapability,
): Promise<CapabilityAllowance> {
  if (capability === AI_CAPABILITIES.basicChat) {
    return buildUnlimitedAllowance(capability);
  }
  if (await hasUnlimitedAICapability(userId, capability)) {
    return buildUnlimitedAllowance(capability);
  }

  const limit = getMeteredLimit(capability);
  if (limit == null) {
    return {
      capability,
      allowed: false,
      unlimited: false,
      limit: 0,
      used: 0,
      remaining: 0,
      periodStart: null,
      periodEnd: null,
    };
  }

  const period = await getCapabilityPeriod(db, capability);
  const used = await countCapabilityUsage(db, userId, capability, period.periodStart);
  return {
    capability,
    allowed: used < limit,
    unlimited: false,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    ...period,
  };
}

function buildLimitError(capability: AICapability) {
  return new CapabilityAllowanceExceededError(capability);
}

export async function consumeCapabilityAllowance(
  executor: CapabilityExecutor,
  params: {
    userId: string;
    capability: AICapability;
    consumptionKey: string;
    metadata?: Record<string, unknown>;
  },
): Promise<CapabilityAllowance> {
  if (await hasUnlimitedAICapability(params.userId, params.capability, executor)) {
    return buildUnlimitedAllowance(params.capability);
  }

  const limit = getMeteredLimit(params.capability);
  if (limit == null) throw buildLimitError(params.capability);
  const period = await getCapabilityPeriod(executor, params.capability);

  await executor.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${params.capability}:${params.userId}`}, 0))`,
  );
  const [existing] = await executor.execute<{ status: string } & Record<string, unknown>>(sql`
    select status
    from ${aiCapabilityUsageEvents}
    where ${aiCapabilityUsageEvents.consumptionKey} = ${params.consumptionKey}
    limit 1
  `);
  if (existing?.status === "consumed") {
    const used = await countCapabilityUsage(
      executor,
      params.userId,
      params.capability,
      period.periodStart,
    );
    return {
      capability: params.capability,
      allowed: true,
      unlimited: false,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      ...period,
    };
  }

  const used = await countCapabilityUsage(
    executor,
    params.userId,
    params.capability,
    period.periodStart,
  );
  if (used >= limit) throw buildLimitError(params.capability);

  if (existing?.status === "refunded") {
    await executor.execute(sql`
      update ${aiCapabilityUsageEvents}
      set
        status = 'consumed',
        refunded_at = null,
        metadata = ${JSON.stringify(params.metadata ?? {})}::jsonb,
        updated_at = now()
      where consumption_key = ${params.consumptionKey}
    `);
  } else {
    await executor.execute(sql`
      insert into ${aiCapabilityUsageEvents} (
        user_id,
        capability,
        consumption_key,
        period_start,
        period_end,
        status,
        metadata
      ) values (
        ${params.userId},
        ${params.capability},
        ${params.consumptionKey},
        ${period.periodStart},
        ${period.periodEnd},
        'consumed',
        ${JSON.stringify(params.metadata ?? {})}::jsonb
      )
    `);
  }

  const nextUsed = used + 1;
  return {
    capability: params.capability,
    allowed: true,
    unlimited: false,
    limit,
    used: nextUsed,
    remaining: Math.max(0, limit - nextUsed),
    ...period,
  };
}

export async function refundCapabilityAllowance(consumptionKey: string): Promise<void> {
  await db
    .update(aiCapabilityUsageEvents)
    .set({ status: "refunded", refundedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(aiCapabilityUsageEvents.consumptionKey, consumptionKey),
        eq(aiCapabilityUsageEvents.status, "consumed"),
      ),
    );
}

export function buildResearchConsumptionKey(runId: string): string {
  return `research-run:${runId}`;
}
