/**
 * User Preferences Store
 *
 * Manages user personalization data on the frontend:
 * - Profile (style analysis, learning preferences)
 * - Persona preference (default and current persona)
 * - Available personas
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BUILT_IN_PERSONAS } from "@/lib/ai/personas/built-in";
import type { AIPersona, PersonaPreference } from "@/lib/ai/personas";

interface UserStyleProfile {
  userId: string;
  metrics: {
    vocabularyComplexity: { value: number; confidence: number; samples: number };
    sentenceComplexity: { value: number; confidence: number; samples: number };
    abstractionLevel: { value: number; confidence: number; samples: number };
    directness: { value: number; confidence: number; samples: number };
    conciseness: { value: number; confidence: number; samples: number };
    formality: { value: number; confidence: number; samples: number };
    emotionalIntensity: { value: number; confidence: number; samples: number };
  };
  bigFive?: {
    openness: { value: number; confidence: number; samples: number };
    conscientiousness: { value: number; confidence: number; samples: number };
    extraversion: { value: number; confidence: number; samples: number };
    agreeableness: { value: number; confidence: number; samples: number };
    neuroticism: { value: number; confidence: number; samples: number };
  };
  totalMessagesAnalyzed: number;
  totalConversationsAnalyzed: number;
  lastAnalyzedAt: Date | null;
}

interface LearningStyle {
  preferredFormat?: string;
  pace?: string;
}

interface UserProfile {
  learningStyle?: LearningStyle;
  style?: UserStyleProfile;
}

interface UserPreferencesState {
  // Data
  profile: UserProfile | null;
  personaPreference: PersonaPreference | null;
  availablePersonas: AIPersona[];
  currentPersonaSlug: string;

  // Loading state
  isLoading: boolean;
  lastFetchedAt: number | null;

  // Actions
  loadPreferences: () => Promise<void>;
  loadBuiltInPersonas: () => void;
  setCurrentPersona: (slug: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => void;
  reset: () => void;
}

const DEFAULT_PERSONA_SLUG = "default";

// Convert built-in personas to AIPersona format
function getBuiltInPersonasAsAI(): AIPersona[] {
  return BUILT_IN_PERSONAS.map((p) => ({
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
  }));
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set, get) => ({
      // Initial state - load built-in personas immediately
      profile: null,
      personaPreference: null,
      availablePersonas: getBuiltInPersonasAsAI(),
      currentPersonaSlug: DEFAULT_PERSONA_SLUG,
      isLoading: false,
      lastFetchedAt: null,

      // Load built-in personas (always available, no login required)
      loadBuiltInPersonas: () => {
        set({ availablePersonas: getBuiltInPersonasAsAI() });
      },

      // Load all preferences from API (requires login)
      loadPreferences: async () => {
        set({ isLoading: true });

        try {
          const response = await fetch("/api/user/preferences");

          if (!response.ok) {
            // If not logged in, still load built-in personas
            if (response.status === 401) {
              set({
                availablePersonas: getBuiltInPersonasAsAI(),
                isLoading: false,
              });
              return;
            }
            throw new Error("Failed to load preferences");
          }

          const data = await response.json();

          set({
            profile: data.profile,
            personaPreference: data.personaPreference,
            availablePersonas: data.availablePersonas,
            currentPersonaSlug: data.personaPreference?.defaultPersonaSlug || DEFAULT_PERSONA_SLUG,
            lastFetchedAt: Date.now(),
            isLoading: false,
          });
        } catch (error) {
          console.error("[UserPreferences] Failed to load:", error);
          // Ensure built-in personas are always available
          set({
            availablePersonas: getBuiltInPersonasAsAI(),
            isLoading: false,
          });
        }
      },

      // Set current persona and update server preference
      setCurrentPersona: async (slug: string) => {
        const { availablePersonas } = get();

        // Validate persona exists
        const persona = availablePersonas.find((p) => p.slug === slug);
        if (!persona) {
          console.error(`[UserPreferences] Persona not found: ${slug}`);
          return;
        }

        // Optimistic update
        set({ currentPersonaSlug: slug });

        // Try to update server preference (may fail if not logged in)
        try {
          const response = await fetch("/api/user/persona", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ personaSlug: slug }),
          });

          if (!response.ok) {
            if (response.status === 401) {
              // Not logged in - persona change is local-only for this session
              console.log("[UserPreferences] Persona change is local-only (not logged in)");
              return;
            }
            throw new Error("Failed to update persona preference");
          }

          set({
            personaPreference: {
              defaultPersonaSlug: slug,
              lastSwitchedAt: new Date(),
            },
          });
        } catch (error) {
          console.error("[UserPreferences] Failed to update persona:", error);
          // Don't revert - keep local change
        }
      },

      // Update local profile data
      updateProfile: (updates: Partial<UserProfile>) => {
        set({
          profile: {
            ...get().profile,
            ...updates,
          },
        });
      },

      // Reset store to initial state
      reset: () => {
        set({
          profile: null,
          personaPreference: null,
          availablePersonas: getBuiltInPersonasAsAI(),
          currentPersonaSlug: DEFAULT_PERSONA_SLUG,
          isLoading: false,
          lastFetchedAt: null,
        });
      },
    }),
    {
      name: "nexusnote-user-preferences",
      partialize: (state) => ({
        // Persist current persona choice and built-in personas
        currentPersonaSlug: state.currentPersonaSlug,
        availablePersonas: state.availablePersonas.filter(p => p.isBuiltIn),
        // Don't persist profile (server data)
      }),
    },
  ),
);

// Initialize built-in personas on module load
useUserPreferencesStore.getState().loadBuiltInPersonas();

// Selectors
export const selectCurrentPersona = (state: UserPreferencesState): AIPersona | undefined => {
  return state.availablePersonas.find((p) => p.slug === state.currentPersonaSlug);
};

export const selectStyleMetrics = (state: UserPreferencesState) => {
  return state.profile?.style?.metrics;
};

export const selectLearningStyle = (state: UserPreferencesState) => {
  return state.profile?.learningStyle;
};
