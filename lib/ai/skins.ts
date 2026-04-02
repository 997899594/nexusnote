import { eq } from "drizzle-orm";
import { aiSkins, db, userSkinPreferences } from "@/db";
import { BUILT_IN_SKINS, getBuiltInSkin } from "./skins-built-in";

export interface AISkin {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatar: string | null;
  systemPrompt: string;
  style: string | null;
  examples: string[];
  isBuiltIn: boolean;
  isEnabled: boolean;
  usageCount: number;
  rating: { total: number; count: number } | null;
}

export interface SkinPreference {
  defaultSkinSlug: string;
  lastSwitchedAt: Date | null;
}

function toSkinRecord(
  skin: Pick<
    AISkin,
    | "id"
    | "slug"
    | "name"
    | "description"
    | "avatar"
    | "systemPrompt"
    | "style"
    | "examples"
    | "isBuiltIn"
    | "isEnabled"
    | "usageCount"
    | "rating"
  >,
): AISkin {
  return {
    id: skin.id,
    slug: skin.slug,
    name: skin.name,
    description: skin.description,
    avatar: skin.avatar,
    systemPrompt: skin.systemPrompt,
    style: skin.style,
    examples: skin.examples,
    isBuiltIn: skin.isBuiltIn,
    isEnabled: skin.isEnabled,
    usageCount: skin.usageCount,
    rating: skin.rating,
  };
}

export async function getSkin(slug: string): Promise<AISkin | null> {
  const builtIn = getBuiltInSkin(slug);
  if (builtIn) {
    return toSkinRecord({
      id: `builtin-${builtIn.slug}`,
      slug: builtIn.slug,
      name: builtIn.name,
      description: builtIn.description,
      avatar: builtIn.avatar || null,
      systemPrompt: builtIn.systemPrompt,
      style: builtIn.style,
      examples: builtIn.examples,
      isBuiltIn: true,
      isEnabled: true,
      usageCount: 0,
      rating: null,
    });
  }

  const skin = await db.query.aiSkins.findFirst({
    where: eq(aiSkins.slug, slug),
  });

  if (!skin) {
    return null;
  }

  return toSkinRecord({
    id: skin.id,
    slug: skin.slug,
    name: skin.name,
    description: skin.description,
    avatar: skin.avatar,
    systemPrompt: skin.systemPrompt,
    style: skin.style,
    examples: (skin.examples as string[]) || [],
    isBuiltIn: skin.isBuiltIn,
    isEnabled: skin.isEnabled,
    usageCount: skin.usageCount,
    rating: skin.rating as { total: number; count: number } | null,
  });
}

export async function getAvailableSkins(userId: string): Promise<AISkin[]> {
  const skins: AISkin[] = BUILT_IN_SKINS.map((skin) =>
    toSkinRecord({
      id: `builtin-${skin.slug}`,
      slug: skin.slug,
      name: skin.name,
      description: skin.description,
      avatar: skin.avatar || null,
      systemPrompt: skin.systemPrompt,
      style: skin.style,
      examples: skin.examples,
      isBuiltIn: true,
      isEnabled: true,
      usageCount: 0,
      rating: null,
    }),
  );

  const customSkins = await db.query.aiSkins.findMany({
    where: eq(aiSkins.authorId, userId),
  });

  for (const skin of customSkins) {
    if (!skin.isEnabled) {
      continue;
    }

    skins.push(
      toSkinRecord({
        id: skin.id,
        slug: skin.slug,
        name: skin.name,
        description: skin.description,
        avatar: skin.avatar,
        systemPrompt: skin.systemPrompt,
        style: skin.style,
        examples: (skin.examples as string[]) || [],
        isBuiltIn: skin.isBuiltIn,
        isEnabled: skin.isEnabled,
        usageCount: skin.usageCount,
        rating: skin.rating as { total: number; count: number } | null,
      }),
    );
  }

  return skins;
}

export async function getUserSkinPreference(userId: string): Promise<SkinPreference> {
  const preference = await db.query.userSkinPreferences.findFirst({
    where: eq(userSkinPreferences.userId, userId),
  });

  return {
    defaultSkinSlug: preference?.defaultSkinSlug || "default",
    lastSwitchedAt: preference?.lastSwitchedAt || null,
  };
}

export async function setUserSkinPreference(userId: string, skinSlug: string): Promise<void> {
  const skin = await getSkin(skinSlug);
  if (!skin) {
    throw new Error(`Skin not found: ${skinSlug}`);
  }

  const existing = await db.query.userSkinPreferences.findFirst({
    where: eq(userSkinPreferences.userId, userId),
  });

  if (existing) {
    await db
      .update(userSkinPreferences)
      .set({
        defaultSkinSlug: skinSlug,
        lastSwitchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userSkinPreferences.id, existing.id));
  } else {
    await db.insert(userSkinPreferences).values({
      userId,
      defaultSkinSlug: skinSlug,
      lastSwitchedAt: new Date(),
    });
  }

  if (!skin.isBuiltIn) {
    await db
      .update(aiSkins)
      .set({
        usageCount: (skin.usageCount || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(aiSkins.slug, skinSlug));
  }
}
