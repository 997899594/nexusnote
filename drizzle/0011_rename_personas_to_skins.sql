ALTER TABLE "personas" RENAME TO "ai_skins";
ALTER TABLE "user_persona_preferences" RENAME TO "user_skin_preferences";

ALTER TABLE "user_skin_preferences"
  RENAME COLUMN "default_persona_slug" TO "default_skin_slug";

ALTER INDEX IF EXISTS "personas_slug_idx" RENAME TO "ai_skins_slug_idx";
ALTER INDEX IF EXISTS "personas_author_id_idx" RENAME TO "ai_skins_author_id_idx";
ALTER INDEX IF EXISTS "personas_is_enabled_idx" RENAME TO "ai_skins_is_enabled_idx";
ALTER INDEX IF EXISTS "user_persona_preferences_user_id_idx" RENAME TO "user_skin_preferences_user_id_idx";

ALTER TABLE "ai_skins" RENAME CONSTRAINT "personas_slug_unique" TO "ai_skins_slug_unique";
ALTER TABLE "ai_skins" RENAME CONSTRAINT "personas_author_id_users_id_fk" TO "ai_skins_author_id_users_id_fk";
ALTER TABLE "user_skin_preferences" RENAME CONSTRAINT "user_persona_preferences_user_id_users_id_fk" TO "user_skin_preferences_user_id_users_id_fk";
ALTER TABLE "user_skin_preferences" RENAME CONSTRAINT "user_persona_preferences_user_id_unique" TO "user_skin_preferences_user_id_unique";
