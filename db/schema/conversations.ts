import {
  boolean,
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

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull().default("新对话"),
    intent: text("intent").notNull().default("CHAT"),
    summary: text("summary"),
    messageCount: integer("message_count").default(0),
    lastMessageAt: timestamp("last_message_at").defaultNow(),
    metadata: jsonb("metadata"),
    isArchived: boolean("is_archived").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    titleGeneratedAt: timestamp("title_generated_at"),
  },
  (table) => ({
    userIdIdx: index("conversations_user_id_idx").on(table.userId),
    lastMessageIdx: index("conversations_last_message_idx").on(table.lastMessageAt),
  }),
);

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    position: integer("position").notNull(),
    role: text("role").notNull(),
    message: jsonb("message").notNull(),
    textContent: text("text_content").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    conversationIdx: index("conversation_messages_conversation_idx").on(table.conversationId),
    conversationPositionIdx: uniqueIndex("conversation_messages_conversation_position_idx").on(
      table.conversationId,
      table.position,
    ),
  }),
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type NewConversationMessage = typeof conversationMessages.$inferInsert;
