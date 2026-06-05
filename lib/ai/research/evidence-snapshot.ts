import type { ResearchEvidenceRequest } from "@/lib/ai/research/evidence-request";
import type { ResearchRetrievalOutput } from "@/lib/ai/research/web-research";

export interface ResearchEvidenceSnapshotSource {
  id: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  provider: string;
  sourceType: string;
  qualityTier: string;
  relevanceScore: number;
  publishedAt?: string;
  extractedAt?: string;
  extractProvider?: string;
  extractionStatus: "extracted" | "snippet_only" | "failed";
  freshnessWindowDays: 30 | 90 | 180;
  searchQuery: string;
  contentPreview: string;
  evidenceChunks: Array<{
    id: string;
    text: string;
    relevanceScore?: number;
  }>;
}

export interface ResearchEvidenceSnapshot {
  id: string;
  status: "ready" | "unavailable";
  unavailableReason?: "disabled" | "not_configured" | "provider_error" | "no_results";
  generatedAt: string;
  requirement: ResearchEvidenceRequest["requirement"];
  domain: ResearchEvidenceRequest["domain"];
  reasonCodes: ResearchEvidenceRequest["reasonCodes"];
  seedMessage: string;
  latestUserMessage: string;
  query: string;
  queries: string[];
  freshnessWindowDays: 30 | 90 | 180;
  summary: {
    queryCount: number;
    providerCount: number;
    sourceCount: number;
    authoritativeCount: number;
    extractedCount: number;
    domainCount: number;
  };
  providerTrace: Array<{
    provider: string;
    status: "used" | "skipped" | "failed";
    message?: string;
  }>;
  sources: ResearchEvidenceSnapshotSource[];
  errors: string[];
}

const AUTHORITATIVE_TYPES = new Set(["official_docs", "release_note", "paper", "source_code"]);
const MAX_UI_QUERY_LENGTH = 360;
const MAX_UI_ERROR_LENGTH = 240;
const MAX_UI_CONTENT_PREVIEW_LENGTH = 900;
const MAX_UI_EVIDENCE_CHUNKS_PER_SOURCE = 2;
const MAX_UI_EVIDENCE_CHUNK_LENGTH = 900;

function truncateForUi(value: string | undefined, maxLength: number): string {
  const normalized = (value ?? "").replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function getStableSnapshotId(request: ResearchEvidenceRequest): string {
  const normalized = [request.domain, request.seedMessage, request.latestUserMessage]
    .join(":")
    .replace(/\s+/gu, " ")
    .trim();

  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }

  return `research-evidence-${hash.toString(36)}`;
}

function buildSummary(sources: ResearchEvidenceSnapshotSource[], queries: string[]) {
  const providers = new Set(
    sources.flatMap((source) => [source.provider, source.extractProvider].filter(Boolean)),
  );
  const domains = new Set(sources.map((source) => source.domain).filter(Boolean));

  return {
    queryCount: queries.length,
    providerCount: providers.size,
    sourceCount: sources.length,
    authoritativeCount: sources.filter((source) => AUTHORITATIVE_TYPES.has(source.sourceType))
      .length,
    extractedCount: sources.filter((source) => source.extractionStatus === "extracted").length,
    domainCount: domains.size,
  };
}

export function buildResearchEvidenceSnapshot(params: {
  request: ResearchEvidenceRequest;
  retrieval: ResearchRetrievalOutput;
  generatedAt?: Date;
}): ResearchEvidenceSnapshot {
  const queries = (
    params.retrieval.queries.length > 0 ? params.retrieval.queries : params.request.queries
  ).map((query) => truncateForUi(query, MAX_UI_QUERY_LENGTH));
  const sources = params.retrieval.sources.map(
    (source): ResearchEvidenceSnapshotSource => ({
      id: source.sourceId,
      title: source.title,
      url: source.url,
      domain: source.domain,
      snippet: truncateForUi(source.snippet, 500),
      provider: source.provider,
      sourceType: source.sourceType,
      qualityTier: source.qualityTier,
      relevanceScore: source.relevanceScore,
      publishedAt: source.publishedAt,
      extractedAt: source.extractedAt,
      extractProvider: source.extractProvider,
      extractionStatus: source.extractionStatus,
      freshnessWindowDays: source.freshnessWindowDays,
      searchQuery: truncateForUi(source.searchQuery, MAX_UI_QUERY_LENGTH),
      contentPreview: truncateForUi(source.contentPreview, MAX_UI_CONTENT_PREVIEW_LENGTH),
      evidenceChunks: source.evidenceChunks
        .slice(0, MAX_UI_EVIDENCE_CHUNKS_PER_SOURCE)
        .map((chunk) => ({
          ...chunk,
          text: truncateForUi(chunk.text, MAX_UI_EVIDENCE_CHUNK_LENGTH),
        })),
    }),
  );

  return {
    id: getStableSnapshotId(params.request),
    status: params.retrieval.success ? "ready" : "unavailable",
    unavailableReason: params.retrieval.unavailableReason,
    generatedAt: (params.generatedAt ?? new Date()).toISOString(),
    requirement: params.request.requirement,
    domain: params.request.domain,
    reasonCodes: params.request.reasonCodes,
    seedMessage: params.request.seedMessage,
    latestUserMessage: params.request.latestUserMessage,
    query: truncateForUi(params.request.query, MAX_UI_QUERY_LENGTH),
    queries,
    freshnessWindowDays: params.request.freshnessWindowDays,
    summary: buildSummary(sources, queries),
    providerTrace: params.retrieval.providerTrace.map((trace) => ({
      ...trace,
      message: trace.message ? truncateForUi(trace.message, MAX_UI_ERROR_LENGTH) : undefined,
    })),
    sources,
    errors: params.retrieval.errors.map((error) => truncateForUi(error, MAX_UI_ERROR_LENGTH)),
  };
}
