/**
 * Persona Service
 *
 * Service layer for managing AI personas, including CRUD operations
 * and user preferences.
 */

import { db, personas, userPersonaPreferences, personaSubscriptions } from "@/db";
import { eq, desc, and } from "drizzle-orm";
import type { Persona, NewPersona, UserPersonaPreference } from "@/db";
import { BUILT_IN_PERSONAS, getBuiltInPersona } from "./built-in";

// ============================================
// Types
// ============================================

export interface AIPersona {
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

export interface PersonaPreference {
  defaultPersonaSlug: string;
  lastSwitchedAt: Date | null;
}

export interface PersonaWithSubscription extends AIPersona {
  isSubscribed?: boolean;
}

// ============================================
// Public API
// ============================================

/**
 * Get a persona by slug (built-in or custom)
 */
export async function getPersona(slug: string): Promise<AIPersona | null> {
  // First check if it's a built-in persona
  const builtIn = getBuiltInPersona(slug);
  if (builtIn) {
    return {
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
    };
  }

  // Check database for custom persona
  const persona = await db.query.personas.findFirst({
    where: eq(personas.slug, slug),
  });

  if (!persona) {
    return null;
  }

  return {
    id: persona.id,
    slug: persona.slug,
    name: persona.name,
    description: persona.description,
    avatar: persona.avatar,
    systemPrompt: persona.systemPrompt,
    style: persona.style,
    examples: (persona.examples as string[]) || [],
    isBuiltIn: persona.isBuiltIn,
    isEnabled: persona.isEnabled,
    usageCount: persona.usageCount,
    rating: persona.rating as { total: number; count: number } | null,
  };
}

/**
 * Get all available personas for a user
 * Includes built-in personas + user's custom personas + subscribed personas
 */
export async function getAvailablePersonas(
  userId: string,
): Promise<AIPersona[]> {
  const result: AIPersona[] = [];

  // Add all built-in personas
  for (const p of BUILT_IN_PERSONAS) {
    result.push({
      id: `builtin-${p.slug}`,
      slug: p.slug,
      name: p.name,
      description: p.description,
      avatar: p.avatar || null,
      systemPrompt: p.systemPrompt,
      style: p.style,
      examples: p.examples,
      isBuiltIn: true,
      isEnabled: true,
      usageCount: 0,
      rating: null,
    });
  }

  // Get user's custom personas
  const customPersonas = await db.query.personas.findMany({
    where: eq(personas.authorId, userId),
  });

  for (const p of customPersonas) {
    if (p.isEnabled) {
      result.push({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        avatar: p.avatar,
        systemPrompt: p.systemPrompt,
        style: p.style,
        examples: (p.examples as string[]) || [],
        isBuiltIn: p.isBuiltIn,
        isEnabled: p.isEnabled,
        usageCount: p.usageCount,
        rating: p.rating as { total: number; count: number } | null,
      });
    }
  }

  // Get subscribed personas
  const subscriptions = await db.query.personaSubscriptions.findMany({
    where: eq(personaSubscriptions.userId, userId),
    with: {
      persona: true,
    },
  });

  for (const sub of subscriptions) {
    if (sub.persona.isEnabled && !result.find((r) => r.slug === sub.persona.slug)) {
      result.push({
        id: sub.persona.id,
        slug: sub.persona.slug,
        name: sub.persona.name,
        description: sub.persona.description,
        avatar: sub.persona.avatar,
        systemPrompt: sub.persona.systemPrompt,
        style: sub.persona.style,
        examples: (sub.persona.examples as string[]) || [],
        isBuiltIn: sub.persona.isBuiltIn,
        isEnabled: sub.persona.isEnabled,
        usageCount: sub.persona.usageCount,
        rating: sub.persona.rating as { total: number; count: number } | null,
      });
    }
  }

  return result;
}

/**
 * Get user's persona preference
 */
export async function getUserPersonaPreference(
  userId: string,
): Promise<PersonaPreference> {
  const pref = await db.query.userPersonaPreferences.findFirst({
    where: eq(userPersonaPreferences.userId, userId),
  });

  return {
    defaultPersonaSlug: pref?.defaultPersonaSlug || "default",
    lastSwitchedAt: pref?.lastSwitchedAt || null,
  };
}

/**
 * Set user's default persona
 */
export async function setUserPersonaPreference(
  userId: string,
  personaSlug: string,
): Promise<void> {
  // Validate persona exists
  const persona = await getPersona(personaSlug);
  if (!persona) {
    throw new Error(`Persona not found: ${personaSlug}`);
  }

  const existing = await db.query.userPersonaPreferences.findFirst({
    where: eq(userPersonaPreferences.userId, userId),
  });

  if (existing) {
    await db
      .update(userPersonaPreferences)
      .set({
        defaultPersonaSlug: personaSlug,
        lastSwitchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userPersonaPreferences.id, existing.id));
  } else {
    await db.insert(userPersonaPreferences).values({
      userId,
      defaultPersonaSlug: personaSlug,
      lastSwitchedAt: new Date(),
    });
  }

  // Increment usage count for custom personas
  if (!persona.isBuiltIn) {
    await db
      .update(personas)
      .set({
        usageCount: (persona.usageCount || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(personas.slug, personaSlug));
  }
}

/**
 * Create a custom persona
 */
export async function createCustomPersona(
  userId: string,
  data: {
    slug: string;
    name: string;
    description?: string;
    avatar?: string;
    systemPrompt: string;
    style?: string;
    examples?: string[];
  },
): Promise<AIPersona> {
  // Check if slug already exists
  const existing = await getPersona(data.slug);
  if (existing) {
    throw new Error(`Persona slug already exists: ${data.slug}`);
  }

  const [persona] = await db
    .insert(personas)
    .values({
      slug: data.slug,
      name: data.name,
      description: data.description || null,
      avatar: data.avatar || null,
      systemPrompt: data.systemPrompt,
      style: data.style || null,
      examples: data.examples || [],
      authorId: userId,
      isBuiltIn: false,
      isEnabled: true,
      usageCount: 0,
    })
    .returning();

  return {
    id: persona.id,
    slug: persona.slug,
    name: persona.name,
    description: persona.description,
    avatar: persona.avatar,
    systemPrompt: persona.systemPrompt,
    style: persona.style,
    examples: (persona.examples as string[]) || [],
    isBuiltIn: persona.isBuiltIn,
    isEnabled: persona.isEnabled,
    usageCount: persona.usageCount,
    rating: persona.rating as { total: number; count: number } | null,
  };
}

/**
 * Update a custom persona (only if user is the author)
 */
export async function updateCustomPersona(
  userId: string,
  slug: string,
  data: Partial<{
    name: string;
    description: string;
    avatar: string;
    systemPrompt: string;
    style: string;
    examples: string[];
    isEnabled: boolean;
  }>,
): Promise<AIPersona> {
  const persona = await db.query.personas.findFirst({
    where: eq(personas.slug, slug),
  });

  if (!persona) {
    throw new Error(`Persona not found: ${slug}`);
  }

  if (persona.authorId !== userId) {
    throw new Error("Not authorized to update this persona");
  }

  const [updated] = await db
    .update(personas)
    .set({
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.avatar !== undefined && { avatar: data.avatar }),
      ...(data.systemPrompt && { systemPrompt: data.systemPrompt }),
      ...(data.style !== undefined && { style: data.style }),
      ...(data.examples !== undefined && { examples: data.examples }),
      ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
      updatedAt: new Date(),
    })
    .where(eq(personas.id, persona.id))
    .returning();

  return {
    id: updated.id,
    slug: updated.slug,
    name: updated.name,
    description: updated.description,
    avatar: updated.avatar,
    systemPrompt: updated.systemPrompt,
    style: updated.style,
    examples: (updated.examples as string[]) || [],
    isBuiltIn: updated.isBuiltIn,
    isEnabled: updated.isEnabled,
    usageCount: updated.usageCount,
    rating: updated.rating as { total: number; count: number } | null,
  };
}

/**
 * Delete a custom persona (only if user is the author)
 */
export async function deleteCustomPersona(
  userId: string,
  slug: string,
): Promise<void> {
  const persona = await db.query.personas.findFirst({
    where: eq(personas.slug, slug),
  });

  if (!persona) {
    throw new Error(`Persona not found: ${slug}`);
  }

  if (persona.authorId !== userId) {
    throw new Error("Not authorized to delete this persona");
  }

  await db.delete(personas).where(eq(personas.id, persona.id));
}

/**
 * Subscribe to a persona
 */
export async function subscribeToPersona(
  userId: string,
  personaId: string,
): Promise<void> {
  const persona = await db.query.personas.findFirst({
    where: eq(personas.id, personaId),
  });

  if (!persona) {
    throw new Error(`Persona not found: ${personaId}`);
  }

  if (persona.isBuiltIn) {
    throw new Error("Cannot subscribe to built-in personas");
  }

  await db
    .insert(personaSubscriptions)
    .values({
      userId,
      personaId,
    })
    .onConflictDoNothing();
}

/**
 * Unsubscribe from a persona
 */
export async function unsubscribeFromPersona(
  userId: string,
  personaId: string,
): Promise<void> {
  await db
    .delete(personaSubscriptions)
    .where(
      and(
        eq(personaSubscriptions.userId, userId),
        eq(personaSubscriptions.personaId, personaId),
      ),
    );
}

/**
 * Rate a persona
 */
export async function ratePersona(
  userId: string,
  slug: string,
  rating: number, // 1-5
): Promise<void> {
  const persona = await db.query.personas.findFirst({
    where: eq(personas.slug, slug),
  });

  if (!persona || persona.isBuiltIn) {
    // Built-in personas can't be rated (or use a separate rating table)
    return;
  }

  const currentRating = persona.rating as { total: number; count: number } | null;

  await db
    .update(personas)
    .set({
      rating: {
        total: (currentRating?.total || 0) + rating,
        count: (currentRating?.count || 0) + 1,
      },
      updatedAt: new Date(),
    })
    .where(eq(personas.id, persona.id));
}
