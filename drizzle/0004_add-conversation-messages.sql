CREATE TABLE "conversation_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "position" integer NOT NULL,
  "role" text NOT NULL,
  "message" jsonb NOT NULL,
  "text_content" text DEFAULT '' NOT NULL,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "conversation_messages"
  ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk"
  FOREIGN KEY ("conversation_id")
  REFERENCES "public"."conversations"("id")
  ON DELETE cascade
  ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "conversation_messages_conversation_idx"
  ON "conversation_messages" USING btree ("conversation_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_messages_conversation_position_idx"
  ON "conversation_messages" USING btree ("conversation_id", "position");
--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN IF EXISTS "messages";
