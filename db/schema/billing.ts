import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const billingOrders = pgTable(
  "billing_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    provider: text("provider").notNull(),
    providerOrderId: text("provider_order_id"),
    providerCheckoutUrl: text("provider_checkout_url"),
    plan: text("plan").notNull(),
    status: text("status").notNull().default("pending"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("CNY"),
    entitlementDays: integer("entitlement_days").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    paidAt: timestamp("paid_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userStatusIdx: index("billing_orders_user_status_idx").on(table.userId, table.status),
    providerOrderIdx: uniqueIndex("billing_orders_provider_order_unique_idx").on(
      table.provider,
      table.providerOrderId,
    ),
    createdAtIdx: index("billing_orders_created_at_idx").on(table.createdAt),
  }),
);

export const userEntitlements = pgTable(
  "user_entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    plan: text("plan").notNull(),
    source: text("source").notNull(),
    sourceRefId: text("source_ref_id").notNull(),
    startsAt: timestamp("starts_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userExpiresIdx: index("user_entitlements_user_expires_idx").on(table.userId, table.expiresAt),
    sourceIdx: uniqueIndex("user_entitlements_source_unique_idx").on(
      table.source,
      table.sourceRefId,
    ),
  }),
);

export const productAccessGrants = pgTable(
  "product_access_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    plan: text("plan").notNull(),
    capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
    source: text("source").notNull(),
    startsAt: timestamp("starts_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailUniqueIdx: uniqueIndex("product_access_grants_email_unique_idx").on(table.email),
    activeIdx: index("product_access_grants_active_idx").on(table.revokedAt, table.expiresAt),
    canonicalEmailCheck: check(
      "product_access_grants_canonical_email_check",
      sql`${table.email} = lower(btrim(${table.email}))`,
    ),
    capabilitiesArrayCheck: check(
      "product_access_grants_capabilities_array_check",
      sql`jsonb_typeof(${table.capabilities}) = 'array'`,
    ),
  }),
);

export const aiCapabilityUsageEvents = pgTable(
  "ai_capability_usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    capability: text("capability").notNull(),
    consumptionKey: text("consumption_key").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("consumed"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    consumptionKeyUniqueIdx: uniqueIndex("ai_capability_usage_events_key_unique_idx").on(
      table.consumptionKey,
    ),
    allowanceIdx: index("ai_capability_usage_events_allowance_idx").on(
      table.userId,
      table.capability,
      table.periodStart,
      table.status,
    ),
    periodCheck: check(
      "ai_capability_usage_events_period_check",
      sql`${table.periodEnd} > ${table.periodStart}`,
    ),
    statusCheck: check(
      "ai_capability_usage_events_status_check",
      sql`${table.status} in ('consumed', 'refunded')`,
    ),
    refundCheck: check(
      "ai_capability_usage_events_refund_check",
      sql`(
        (${table.status} = 'consumed' and ${table.refundedAt} is null)
        or (${table.status} = 'refunded' and ${table.refundedAt} is not null)
      )`,
    ),
  }),
);

export const billingWebhookEvents = pgTable(
  "billing_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    signature: text("signature"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    providerEventIdx: uniqueIndex("billing_webhook_events_provider_event_unique_idx").on(
      table.provider,
      table.eventId,
    ),
  }),
);

export const redeemCodes = pgTable(
  "redeem_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeHash: text("code_hash").notNull().unique(),
    plan: text("plan").notNull(),
    entitlementDays: integer("entitlement_days").notNull(),
    maxRedemptions: integer("max_redemptions").notNull().default(1),
    redeemedCount: integer("redeemed_count").notNull().default(0),
    expiresAt: timestamp("expires_at"),
    disabledAt: timestamp("disabled_at"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    codeHashIdx: uniqueIndex("redeem_codes_code_hash_unique_idx").on(table.codeHash),
  }),
);

export const redeemCodeRedemptions = pgTable(
  "redeem_code_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeId: uuid("code_id")
      .references(() => redeemCodes.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    entitlementId: uuid("entitlement_id").references(() => userEntitlements.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    codeUserIdx: uniqueIndex("redeem_code_redemptions_code_user_unique_idx").on(
      table.codeId,
      table.userId,
    ),
  }),
);

export type BillingOrder = typeof billingOrders.$inferSelect;
export type NewBillingOrder = typeof billingOrders.$inferInsert;
export type UserEntitlement = typeof userEntitlements.$inferSelect;
export type NewUserEntitlement = typeof userEntitlements.$inferInsert;
export type ProductAccessGrant = typeof productAccessGrants.$inferSelect;
export type AICapabilityUsageEvent = typeof aiCapabilityUsageEvents.$inferSelect;
export type BillingWebhookEvent = typeof billingWebhookEvents.$inferSelect;
export type NewBillingWebhookEvent = typeof billingWebhookEvents.$inferInsert;
export type RedeemCode = typeof redeemCodes.$inferSelect;
export type NewRedeemCode = typeof redeemCodes.$inferInsert;
export type RedeemCodeRedemption = typeof redeemCodeRedemptions.$inferSelect;
export type NewRedeemCodeRedemption = typeof redeemCodeRedemptions.$inferInsert;
