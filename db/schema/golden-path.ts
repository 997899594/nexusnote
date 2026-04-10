import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const userGoldenPathPreferences = pgTable(
  "user_golden_path_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    currentRouteId: text("current_route_id").notNull(),
    lastConfirmedAt: timestamp("last_confirmed_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    userIdIdx: index("user_golden_path_preferences_user_id_idx").on(table.userId),
  }),
);

export type UserGoldenPathPreferenceRecord = typeof userGoldenPathPreferences.$inferSelect;
export type NewUserGoldenPathPreferenceRecord = typeof userGoldenPathPreferences.$inferInsert;
