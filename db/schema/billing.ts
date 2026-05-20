import {
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
export type BillingWebhookEvent = typeof billingWebhookEvents.$inferSelect;
export type NewBillingWebhookEvent = typeof billingWebhookEvents.$inferInsert;
export type RedeemCode = typeof redeemCodes.$inferSelect;
export type NewRedeemCode = typeof redeemCodes.$inferInsert;
export type RedeemCodeRedemption = typeof redeemCodeRedemptions.$inferSelect;
export type NewRedeemCodeRedemption = typeof redeemCodeRedemptions.$inferInsert;
