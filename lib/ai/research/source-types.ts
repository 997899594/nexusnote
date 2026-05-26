import { z } from "zod";

export const researchSearchProviderSchema = z.enum(["tavily", "exa", "jina-search"]);
export const researchExtractProviderSchema = z.enum([
  "tavily-extract",
  "firecrawl",
  "jina-reader",
  "exa-contents",
  "search-snippet",
]);

export const researchSourceTypeSchema = z.enum([
  "official_docs",
  "release_note",
  "paper",
  "source_code",
  "technical_blog",
  "news",
  "community",
  "seo_aggregator",
  "unknown",
]);

export const researchSourceQualityTierSchema = z.enum(["primary", "high", "standard", "low"]);

export const researchEvidenceChunkSchema = z.object({
  id: z.string().trim().min(1).max(40),
  text: z.string().trim().min(1).max(1600),
  relevanceScore: z.number().int().min(0).max(100).optional(),
});

export const researchCitationRefSchema = z.object({
  id: z.string().trim().min(1).max(24),
  title: z.string().trim().min(1).max(240),
  url: z.string().url(),
  domain: z.string().trim().min(1).max(160),
  sourceType: researchSourceTypeSchema.optional(),
  qualityTier: researchSourceQualityTierSchema.optional(),
  provider: researchSearchProviderSchema.optional(),
  extractProvider: researchExtractProviderSchema.optional(),
  publishedAt: z.string().trim().min(1).max(80).optional(),
  snippet: z.string().trim().min(1).max(500).optional(),
});

export type ResearchSearchProvider = z.infer<typeof researchSearchProviderSchema>;
export type ResearchExtractProvider = z.infer<typeof researchExtractProviderSchema>;
export type ResearchSourceType = z.infer<typeof researchSourceTypeSchema>;
export type ResearchSourceQualityTier = z.infer<typeof researchSourceQualityTierSchema>;
export type ResearchEvidenceChunk = z.infer<typeof researchEvidenceChunkSchema>;
export type ResearchCitationRef = z.infer<typeof researchCitationRefSchema>;
