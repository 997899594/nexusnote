export interface AISkin {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatar: string | null;
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
