import type {
  ResearchEvidenceChunk,
  ResearchExtractProvider,
  ResearchSearchProvider,
  ResearchSourceQualityTier,
  ResearchSourceType,
} from "./source-types";

export interface ResearchSearchResult {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  provider: ResearchSearchProvider;
  score: number;
  publishedAt?: string;
  text?: string;
}

export interface ResearchEvidenceSource {
  sourceId: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  provider: ResearchSearchProvider;
  sourceType: ResearchSourceType;
  qualityTier: ResearchSourceQualityTier;
  qualityScore: number;
  relevanceScore: number;
  publishedAt?: string;
  extractedAt?: string;
  extractProvider?: ResearchExtractProvider;
  extractionStatus: "extracted" | "snippet_only" | "failed";
  freshnessWindowDays: 30 | 90 | 180;
  searchQuery: string;
  contentPreview: string;
  evidenceChunks: ResearchEvidenceChunk[];
}

export interface ResearchRetrievalOutput {
  success: boolean;
  query: string;
  queries: string[];
  answer: string | null;
  sources: ResearchEvidenceSource[];
  unavailableReason?: "disabled" | "not_configured" | "provider_error" | "no_results";
  errors: string[];
  providerTrace: Array<{
    provider: ResearchSearchProvider | ResearchExtractProvider | "reranker";
    status: "used" | "skipped" | "failed";
    message?: string;
  }>;
}

export type ResearchEvidenceProgress =
  | {
      stage: "searching";
      query: string;
      queries: string[];
      freshnessWindowDays: 30 | 90 | 180;
    }
  | { stage: "searched"; query: string; resultCount: number }
  | { stage: "reading"; query: string; sourceCount: number }
  | { stage: "read"; query: string; sourceCount: number; extractedCount: number }
  | { stage: "ranking"; query: string; sourceCount: number }
  | { stage: "completed"; query: string; sourceCount: number; extractedCount: number }
  | { stage: "unavailable"; query: string; reason: string };

export interface CollectResearchEvidenceInput {
  query: string;
  queries?: string[];
  focus?: string;
  limit?: number;
  maxExtractedSources?: number;
  freshnessWindowDays?: 30 | 90 | 180;
  userId?: string;
  traceId?: string;
  onProgress?: (progress: ResearchEvidenceProgress) => void | Promise<void>;
}

export interface ExtractedDocument {
  url: string;
  title?: string;
  content: string;
  provider: ResearchExtractProvider;
  extractedAt: string;
}

export type UnrankedResearchEvidenceSource = Omit<
  ResearchEvidenceSource,
  "sourceId" | "relevanceScore" | "evidenceChunks"
>;
