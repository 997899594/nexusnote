/**
 * User Preferences Store
 *
 * Manages user AI preference data on the frontend:
 * - Profile (style analysis, learning preferences)
 * - Skin preference (default and current expression skin)
 * - Available skins
 *
 */

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { type AIPreferences, DEFAULT_AI_PREFERENCES } from "@/lib/ai/preferences";
import type { AISkin, SkinPreference } from "@/lib/ai/skins";
import { BUILT_IN_SKINS } from "@/lib/ai/skins-built-in";

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
  aiPreferences?: AIPreferences;
  style?: UserStyleProfile;
}

interface UserPreferencesState {
  // Data
  profile: UserProfile | null;
  skinPreference: SkinPreference | null;
  availableSkins: AISkin[];
  currentSkinSlug: string;

  // Loading state
  isLoading: boolean;
  lastFetchedAt: number | null;

  // Actions
  loadPreferences: () => Promise<void>;
  loadBuiltInSkins: () => void;
  setCurrentSkin: (slug: string) => Promise<void>;
  saveProfilePreferences: (updates: {
    learningStyle?: LearningStyle;
    aiPreferences?: AIPreferences;
  }) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => void;
  reset: () => void;
}

const DEFAULT_SKIN_SLUG = "default";

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

function getBuiltInSkins(): AISkin[] {
  return BUILT_IN_SKINS.map((skin) => ({
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
  }));
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set, get) => ({
      // Initial state
      profile: {
        learningStyle: { preferredFormat: "mixed", pace: "moderate" },
        aiPreferences: DEFAULT_AI_PREFERENCES,
      },
      skinPreference: null,
      availableSkins: getBuiltInSkins(),
      currentSkinSlug: DEFAULT_SKIN_SLUG,
      isLoading: false,
      lastFetchedAt: null,

      // Load built-in skins (always available, no login required)
      loadBuiltInSkins: () => {
        const availableSkins = getBuiltInSkins();
        set({
          availableSkins,
        });
      },

      // Load all preferences from API (requires login)
      loadPreferences: async () => {
        set({ isLoading: true });

        try {
          const response = await fetch("/api/user/preferences");

          if (!response.ok) {
            // If not logged in, still load built-in skins
            if (response.status === 401) {
              const availableSkins = getBuiltInSkins();
              set({
                availableSkins,
                isLoading: false,
              });
              return;
            }
            throw new Error("Failed to load preferences");
          }

          const data = await response.json();

          set({
            profile: data.profile,
            skinPreference: data.skinPreference,
            availableSkins: data.availableSkins,
            currentSkinSlug: data.skinPreference?.defaultSkinSlug || DEFAULT_SKIN_SLUG,
            lastFetchedAt: Date.now(),
            isLoading: false,
          });
        } catch (error) {
          console.error("[UserPreferences] Failed to load:", error);
          // Ensure built-in skins are always available
          const availableSkins = getBuiltInSkins();
          set({
            availableSkins,
            isLoading: false,
          });
        }
      },

      saveProfilePreferences: async (updates) => {
        const response = await fetch("/api/user/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error("Failed to save AI preferences");
        }

        const data = await response.json();
        set((state) => ({
          profile: {
            ...state.profile,
            ...data.profile,
          },
        }));
      },

      // Set current skin and update server preference
      setCurrentSkin: async (slug: string) => {
        const { availableSkins } = get();

        const skin = availableSkins.find((item) => item.slug === slug);
        if (!skin) {
          console.error(`[UserPreferences] Skin not found: ${slug}`);
          return;
        }

        // Optimistic update
        set({ currentSkinSlug: slug });

        // Try to update server preference (may fail if not logged in)
        try {
          const response = await fetch("/api/user/skin", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ skinSlug: slug }),
          });

          if (!response.ok) {
            if (response.status === 401) {
              console.log("[UserPreferences] Skin change is local-only (not logged in)");
              return;
            }
            throw new Error("Failed to update skin preference");
          }

          const nextPreference: SkinPreference = {
            defaultSkinSlug: slug,
            lastSwitchedAt: new Date(),
          };

          set({
            skinPreference: nextPreference,
          });
        } catch (error) {
          console.error("[UserPreferences] Failed to update skin:", error);
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
          profile: {
            learningStyle: { preferredFormat: "mixed", pace: "moderate" },
            aiPreferences: DEFAULT_AI_PREFERENCES,
          },
          skinPreference: null,
          availableSkins: getBuiltInSkins(),
          currentSkinSlug: DEFAULT_SKIN_SLUG,
          isLoading: false,
          lastFetchedAt: null,
        });
      },
    }),
    {
      name: "nexusnote-user-preferences",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? noopStorage : window.localStorage,
      ),
      partialize: (state) => ({
        // Persist current skin choice and built-in skins
        currentSkinSlug: state.currentSkinSlug,
        availableSkins: state.availableSkins.filter((skin) => skin.isBuiltIn),
        // Don't persist profile (server data)
      }),
    },
  ),
);

export const selectCurrentSkin = (state: UserPreferencesState): AISkin | undefined => {
  return state.availableSkins.find((skin) => skin.slug === state.currentSkinSlug);
};

export const selectStyleMetrics = (state: UserPreferencesState) => {
  return state.profile?.style?.metrics;
};

export const selectLearningStyle = (state: UserPreferencesState) => {
  return state.profile?.learningStyle;
};
