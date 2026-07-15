import { env } from "@/config/env";
import { createRagTrace } from "@/lib/rag/observability";
import type { ResearchSearchProvider } from "./source-types";
import type {
  CollectResearchEvidenceInput,
  ExtractedDocument,
  ResearchEvidenceSource,
  ResearchRetrievalOutput,
  ResearchSearchResult,
  UnrankedResearchEvidenceSource,
} from "./web-research-contracts";
import { extractResearchDocuments } from "./web-research-extraction";
import {
  buildCacheKey,
  buildQueryVariants,
  clampScore,
  classifySource,
  cleanText,
  fetchJson,
  formatError,
  getAi302Origin,
  getCacheTtlSeconds,
  getDomain,
  getExaSearchType,
  getFreshnessWindowDays,
  getProviderFreshnessStartDate,
  MIN_EXTRACTED_CONTENT_LENGTH,
  normalizeQueryList,
  normalizeUrl,
  readCache,
  truncateText,
  writeCache,
} from "./web-research-foundation";
import { rankResearchEvidenceSources } from "./web-research-ranking";

export type {
  ResearchEvidenceProgress,
  ResearchEvidenceSource,
  ResearchRetrievalOutput,
  ResearchSearchResult,
} from "./web-research-contracts";

const DEFAULT_LIMIT = 6;
const DEFAULT_EXTRACT_LIMIT = 8;
const AI_302_SEARCH_PROVIDER = "tavily";

function mapTavilyResult(result: Record<string, unknown>): ResearchSearchResult | null {
  const url = typeof result.url === "string" ? result.url : "";
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    return null;
  }

  return {
    title:
      typeof result.title === "string" && result.title.trim() ? result.title.trim() : normalizedUrl,
    url: normalizedUrl,
    domain: getDomain(normalizedUrl),
    snippet: cleanText(typeof result.content === "string" ? result.content : ""),
    provider: "tavily",
    score: typeof result.score === "number" ? clampScore(result.score * 100) : 70,
    publishedAt: typeof result.published_date === "string" ? result.published_date : undefined,
  };
}

function mapExaResult(result: Record<string, unknown>): ResearchSearchResult | null {
  const url = typeof result.url === "string" ? result.url : "";
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    return null;
  }

  const text = cleanText(typeof result.text === "string" ? result.text : "");
  const summary = cleanText(typeof result.summary === "string" ? result.summary : "");
  const highlights = Array.isArray(result.highlights)
    ? cleanText(result.highlights.filter((item) => typeof item === "string").join("\n"))
    : "";

  return {
    title:
      typeof result.title === "string" && result.title.trim() ? result.title.trim() : normalizedUrl,
    url: normalizedUrl,
    domain: getDomain(normalizedUrl),
    snippet: truncateText(highlights || summary || text, 500),
    provider: "exa",
    score: typeof result.score === "number" ? clampScore(result.score * 100) : 72,
    publishedAt: typeof result.publishedDate === "string" ? result.publishedDate : undefined,
    text: text.length >= MIN_EXTRACTED_CONTENT_LENGTH ? text : undefined,
  };
}

function mapJinaSearchResult(result: Record<string, unknown>): ResearchSearchResult | null {
  const url = typeof result.url === "string" ? result.url : "";
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    return null;
  }

  const content =
    cleanText(typeof result.content === "string" ? result.content : "") ||
    cleanText(typeof result.description === "string" ? result.description : "");

  return {
    title:
      typeof result.title === "string" && result.title.trim() ? result.title.trim() : normalizedUrl,
    url: normalizedUrl,
    domain: getDomain(normalizedUrl),
    snippet: truncateText(content, 500),
    provider: "jina-search",
    score: 66,
    publishedAt:
      typeof result.publishedTime === "string"
        ? result.publishedTime
        : typeof result.date === "string"
          ? result.date
          : undefined,
  };
}

function map302SearchResult(result: Record<string, unknown>): ResearchSearchResult | null {
  const url = typeof result.url === "string" ? result.url : "";
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    return null;
  }

  const content =
    cleanText(typeof result.content === "string" ? result.content : "") ||
    cleanText(typeof result.raw_content === "string" ? result.raw_content : "") ||
    cleanText(typeof result.summary === "string" ? result.summary : "") ||
    cleanText(typeof result.description === "string" ? result.description : "");

  return {
    title:
      typeof result.title === "string" && result.title.trim() ? result.title.trim() : normalizedUrl,
    url: normalizedUrl,
    domain: getDomain(normalizedUrl),
    snippet: truncateText(content, 500),
    provider: "302-search",
    score: typeof result.score === "number" ? clampScore(result.score * 100) : 68,
    publishedAt:
      typeof result.published_at === "string" && result.published_at.trim()
        ? result.published_at
        : typeof result.publishedAt === "string" && result.publishedAt.trim()
          ? result.publishedAt
          : undefined,
    text: content.length >= MIN_EXTRACTED_CONTENT_LENGTH ? content : undefined,
  };
}

async function searchWithTavily(
  query: string,
  limit: number,
  freshnessWindowDays: 30 | 90 | 180,
): Promise<{ answer: string | null; results: ResearchSearchResult[] }> {
  const freshnessStartDate = getProviderFreshnessStartDate(query, freshnessWindowDays);
  const cacheKey = buildCacheKey([
    "search",
    "tavily",
    query,
    limit,
    freshnessWindowDays,
    freshnessStartDate,
  ]);
  const cached = await readCache<{ answer: string | null; results: ResearchSearchResult[] }>(
    cacheKey,
  );
  if (cached) {
    return cached;
  }

  const data = await fetchJson<Record<string, unknown>>("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      max_results: limit,
      include_answer: true,
      include_raw_content: false,
      search_depth: "advanced",
      chunks_per_source: 3,
      ...(freshnessStartDate ? { start_date: freshnessStartDate } : {}),
    }),
    timeoutMs: 15_000,
  });

  const output = {
    answer: typeof data.answer === "string" ? data.answer : null,
    results: Array.isArray(data.results)
      ? data.results
          .filter(
            (item): item is Record<string, unknown> => item != null && typeof item === "object",
          )
          .map(mapTavilyResult)
          .filter((item): item is ResearchSearchResult => item != null)
      : [],
  };

  await writeCache(cacheKey, output, getCacheTtlSeconds(freshnessWindowDays));
  return output;
}

async function searchWithExa(
  query: string,
  limit: number,
  freshnessWindowDays: 30 | 90 | 180,
): Promise<{ answer: string | null; results: ResearchSearchResult[] }> {
  const freshnessStartDate = getProviderFreshnessStartDate(query, freshnessWindowDays);
  const searchType = getExaSearchType(query);
  const cacheKey = buildCacheKey([
    "search",
    "exa",
    query,
    limit,
    freshnessWindowDays,
    freshnessStartDate,
    searchType,
  ]);
  const cached = await readCache<{ answer: string | null; results: ResearchSearchResult[] }>(
    cacheKey,
  );
  if (cached) {
    return cached;
  }

  const data = await fetchJson<Record<string, unknown>>("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.EXA_API_KEY ?? "",
    },
    body: JSON.stringify({
      query,
      type: searchType,
      numResults: limit,
      systemPrompt:
        "Prefer official documentation, papers, release notes, source repositories, and original technical posts. Avoid SEO aggregators and duplicate summaries.",
      contents: {
        highlights: {
          query,
          maxCharacters: 1200,
        },
        text: {
          maxCharacters: 5000,
        },
      },
      ...(freshnessStartDate ? { startPublishedDate: `${freshnessStartDate}T00:00:00.000Z` } : {}),
    }),
    timeoutMs: 15_000,
  });

  const output = {
    answer: null,
    results: Array.isArray(data.results)
      ? data.results
          .filter(
            (item): item is Record<string, unknown> => item != null && typeof item === "object",
          )
          .map(mapExaResult)
          .filter((item): item is ResearchSearchResult => item != null)
      : [],
  };

  await writeCache(cacheKey, output, getCacheTtlSeconds(freshnessWindowDays));
  return output;
}

async function searchWithJina(
  query: string,
  limit: number,
  freshnessWindowDays: 30 | 90 | 180,
): Promise<{ answer: string | null; results: ResearchSearchResult[] }> {
  const cacheKey = buildCacheKey(["search", "jina-search", query, limit, freshnessWindowDays]);
  const cached = await readCache<{ answer: string | null; results: ResearchSearchResult[] }>(
    cacheKey,
  );
  if (cached) {
    return cached;
  }

  const data = await fetchJson<Record<string, unknown>>(
    `https://s.jina.ai/${encodeURIComponent(query)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${env.JINA_API_KEY}`,
      },
      timeoutMs: 15_000,
    },
  );
  const rawResults = Array.isArray(data.data)
    ? data.data
    : Array.isArray(data.results)
      ? data.results
      : [];

  const output = {
    answer: null,
    results: rawResults
      .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
      .map(mapJinaSearchResult)
      .filter((item): item is ResearchSearchResult => item != null)
      .slice(0, limit),
  };

  await writeCache(cacheKey, output, getCacheTtlSeconds(freshnessWindowDays));
  return output;
}

async function searchWith302(
  query: string,
  limit: number,
  freshnessWindowDays: 30 | 90 | 180,
): Promise<{ answer: string | null; results: ResearchSearchResult[] }> {
  const cacheKey = buildCacheKey([
    "search",
    "302-search",
    AI_302_SEARCH_PROVIDER,
    query,
    limit,
    freshnessWindowDays,
  ]);
  const cached = await readCache<{ answer: string | null; results: ResearchSearchResult[] }>(
    cacheKey,
  );
  if (cached) {
    return cached;
  }

  const data = await fetchJson<Record<string, unknown>>(`${getAi302Origin()}/302/general/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.AI_302_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      provider: AI_302_SEARCH_PROVIDER,
      max_results: limit,
    }),
    timeoutMs: 20_000,
  });

  const nestedData =
    data.data && typeof data.data === "object" ? (data.data as Record<string, unknown>) : {};
  const rawResults = Array.isArray(data.search_results)
    ? data.search_results
    : Array.isArray(data.results)
      ? data.results
      : Array.isArray(nestedData.results)
        ? nestedData.results
        : [];
  const answer =
    typeof nestedData.answer === "string" && nestedData.answer.trim()
      ? nestedData.answer
      : typeof data.answer === "string" && data.answer.trim()
        ? data.answer
        : null;

  const output = {
    answer,
    results: rawResults
      .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
      .map(map302SearchResult)
      .filter((item): item is ResearchSearchResult => item != null)
      .slice(0, limit),
  };

  await writeCache(cacheKey, output, getCacheTtlSeconds(freshnessWindowDays));
  return output;
}

async function searchAcrossProviders(
  query: string,
  limit: number,
  freshnessWindowDays: 30 | 90 | 180,
): Promise<{
  answer: string | null;
  results: ResearchSearchResult[];
  errors: string[];
  providerTrace: ResearchRetrievalOutput["providerTrace"];
}> {
  const errors: string[] = [];
  const providerTrace: ResearchRetrievalOutput["providerTrace"] = [];
  const primaryTasks: Array<{
    provider: ResearchSearchProvider;
    run: Promise<{ answer: string | null; results: ResearchSearchResult[] }>;
  }> = [];

  if (env.AI_302_API_KEY) {
    primaryTasks.push({
      provider: "302-search",
      run: searchWith302(query, limit, freshnessWindowDays),
    });
  } else {
    providerTrace.push({
      provider: "302-search",
      status: "skipped",
      message: "AI_302_API_KEY missing",
    });
  }

  if (env.TAVILY_API_KEY) {
    primaryTasks.push({
      provider: "tavily",
      run: searchWithTavily(query, limit, freshnessWindowDays),
    });
  } else {
    providerTrace.push({
      provider: "tavily",
      status: "skipped",
      message: "TAVILY_API_KEY missing",
    });
  }

  if (env.EXA_API_KEY) {
    primaryTasks.push({
      provider: "exa",
      run: searchWithExa(query, limit, freshnessWindowDays),
    });
  } else {
    providerTrace.push({ provider: "exa", status: "skipped", message: "EXA_API_KEY missing" });
  }

  if (env.JINA_API_KEY) {
    primaryTasks.push({
      provider: "jina-search",
      run: searchWithJina(query, limit, freshnessWindowDays),
    });
  } else {
    providerTrace.push({
      provider: "jina-search",
      status: "skipped",
      message: "JINA_API_KEY missing",
    });
  }

  const primaryResults = await Promise.allSettled(primaryTasks.map((task) => task.run));
  const answer =
    primaryResults.find(
      (
        result,
      ): result is PromiseFulfilledResult<{
        answer: string | null;
        results: ResearchSearchResult[];
      }> => result.status === "fulfilled" && Boolean(result.value.answer),
    )?.value.answer ?? null;
  const results = primaryResults.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value.results;
    }

    const provider = primaryTasks[index]?.provider;
    errors.push(formatError(result.reason));
    if (provider) {
      providerTrace.push({
        provider,
        status: "failed",
        message: formatError(result.reason),
      });
    }
    return [];
  });

  primaryResults.forEach((result, index) => {
    if (result.status === "fulfilled") {
      providerTrace.push({ provider: primaryTasks[index].provider, status: "used" });
    }
  });

  return { answer, results, errors, providerTrace };
}

function dedupeSearchResults(results: ResearchSearchResult[]): ResearchSearchResult[] {
  const byUrl = new Map<string, ResearchSearchResult>();

  for (const result of results) {
    const key = normalizeUrl(result.url);
    if (!key) {
      continue;
    }

    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, result);
      continue;
    }

    const existingQuality = classifySource(existing.url, existing.title).qualityScore;
    const nextQuality = classifySource(result.url, result.title).qualityScore;
    const existingScore = existing.score + existingQuality;
    const nextScore = result.score + nextQuality;

    if (nextScore > existingScore) {
      byUrl.set(key, {
        ...result,
        snippet: result.snippet || existing.snippet,
        text: result.text ?? existing.text,
      });
    }
  }

  return Array.from(byUrl.values());
}

function buildEvidenceSource(params: {
  result: ResearchSearchResult;
  document: ExtractedDocument | null;
  freshnessWindowDays: 30 | 90 | 180;
  searchQuery: string;
}): UnrankedResearchEvidenceSource {
  const classification = classifySource(params.result.url, params.result.title);
  const extractedContent = params.document?.content;
  const snippet = truncateText(
    params.result.snippet || extractedContent || params.result.title,
    500,
  );
  const contentPreview = truncateText(
    extractedContent || params.result.snippet || params.result.title,
    5000,
  );

  return {
    title: params.document?.title || params.result.title,
    url: params.result.url,
    domain: params.result.domain,
    snippet,
    provider: params.result.provider,
    sourceType: classification.sourceType,
    qualityTier: classification.qualityTier,
    qualityScore: classification.qualityScore,
    publishedAt: params.result.publishedAt,
    extractedAt: params.document?.extractedAt,
    extractProvider: params.document?.provider ?? "search-snippet",
    extractionStatus: params.document ? "extracted" : "snippet_only",
    freshnessWindowDays: params.freshnessWindowDays,
    searchQuery: params.searchQuery,
    contentPreview,
  };
}

export function hasResearchProviderConfigured(): boolean {
  return Boolean(env.AI_302_API_KEY || env.TAVILY_API_KEY || env.EXA_API_KEY || env.JINA_API_KEY);
}

async function collectResearchEvidenceOperation(
  input: CollectResearchEvidenceInput,
  trace: ReturnType<typeof createRagTrace>,
): Promise<ResearchRetrievalOutput> {
  const query = input.query.replace(/\s+/gu, " ").trim();
  const freshnessWindowDays = input.freshnessWindowDays ?? getFreshnessWindowDays(query);
  const limit = Math.max(1, Math.min(input.limit ?? DEFAULT_LIMIT, 12));
  const maxExtractedSources = Math.max(
    1,
    Math.min(input.maxExtractedSources ?? DEFAULT_EXTRACT_LIMIT, 12),
  );
  const providerTrace: ResearchRetrievalOutput["providerTrace"] = [];
  const errors: string[] = [];

  if (!env.AI_ENABLE_WEB_SEARCH) {
    await input.onProgress?.({
      stage: "unavailable",
      query,
      reason: "AI_ENABLE_WEB_SEARCH=false",
    });
    return {
      success: false,
      query,
      queries: [query],
      answer: null,
      sources: [],
      unavailableReason: "disabled",
      errors: ["AI_ENABLE_WEB_SEARCH=false"],
      providerTrace,
    };
  }

  if (!hasResearchProviderConfigured()) {
    await input.onProgress?.({
      stage: "unavailable",
      query,
      reason: "No web research provider configured",
    });
    return {
      success: false,
      query,
      queries: [query],
      answer: null,
      sources: [],
      unavailableReason: "not_configured",
      errors: ["No web research provider configured"],
      providerTrace,
    };
  }

  const queries = normalizeQueryList(query, [
    ...buildQueryVariants(query, input.focus),
    ...(input.queries ?? []),
  ]);
  await input.onProgress?.({
    stage: "searching",
    query,
    queries,
    freshnessWindowDays,
  });
  const searchOutputs = await Promise.all(
    queries.map((variant) => searchAcrossProviders(variant, limit, freshnessWindowDays)),
  );
  const answer = searchOutputs.find((output) => output.answer)?.answer ?? null;

  for (const output of searchOutputs) {
    errors.push(...output.errors);
    providerTrace.push(...output.providerTrace);
  }
  trace.step("provider-search", {
    queryCount: queries.length,
    resultCount: searchOutputs.reduce((count, output) => count + output.results.length, 0),
    providerFailures: providerTrace.filter((item) => item.status === "failed").length,
  });

  const results = dedupeSearchResults(searchOutputs.flatMap((output) => output.results))
    .map((result) => {
      const classification = classifySource(result.url, result.title);
      return {
        result,
        rankScore: result.score * 0.55 + classification.qualityScore * 0.45,
      };
    })
    .sort((left, right) => right.rankScore - left.rankScore)
    .map((item) => item.result)
    .slice(0, Math.max(limit, maxExtractedSources));
  await input.onProgress?.({
    stage: "searched",
    query,
    resultCount: results.length,
  });

  const extractionTargets = results.slice(0, maxExtractedSources);
  await input.onProgress?.({
    stage: "reading",
    query,
    sourceCount: extractionTargets.length,
  });
  const documents = await extractResearchDocuments(
    extractionTargets,
    freshnessWindowDays,
    providerTrace,
  );
  trace.step("extraction", {
    requestedCount: extractionTargets.length,
    extractedCount: documents.size,
  });
  await input.onProgress?.({
    stage: "read",
    query,
    sourceCount: extractionTargets.length,
    extractedCount: documents.size,
  });

  const sourcesWithoutRank = results.map((result) =>
    buildEvidenceSource({
      result,
      document: documents.get(result.url) ?? null,
      freshnessWindowDays,
      searchQuery: query,
    }),
  );

  await input.onProgress?.({
    stage: "ranking",
    query,
    sourceCount: sourcesWithoutRank.length,
  });
  const rankedSources = await rankResearchEvidenceSources(query, sourcesWithoutRank, providerTrace);
  const rerankerTrace = providerTrace.findLast((item) => item.provider === "reranker");
  trace.step("reranker", {
    status: rerankerTrace?.status ?? "not-reached",
    candidateCount: sourcesWithoutRank.length,
    rankedCount: rankedSources.length,
  });
  const sources = rankedSources.slice(0, limit);
  trace.step("context-compression", {
    enabled: env.CONTEXT_COMPRESSION_ENABLED,
    sourceCount: sources.length,
    chunkCount: sources.reduce((count, source) => count + source.evidenceChunks.length, 0),
    outputChars: sources.reduce(
      (count, source) =>
        count + source.evidenceChunks.reduce((sum, chunk) => sum + chunk.text.length, 0),
      0,
    ),
  });
  await input.onProgress?.({
    stage: "completed",
    query,
    sourceCount: sources.length,
    extractedCount: sources.filter((source) => source.extractionStatus === "extracted").length,
  });

  return {
    success: sources.length > 0,
    query,
    queries,
    answer,
    sources,
    unavailableReason:
      sources.length > 0 ? undefined : errors.length > 0 ? "provider_error" : "no_results",
    errors,
    providerTrace,
  };
}

export async function collectResearchEvidence(
  input: CollectResearchEvidenceInput,
): Promise<ResearchRetrievalOutput> {
  const trace = createRagTrace(
    "research-evidence",
    {
      query: input.query,
      hasUserId: Boolean(input.userId),
      requestedLimit: input.limit ?? DEFAULT_LIMIT,
      requestedExtractLimit: input.maxExtractedSources ?? DEFAULT_EXTRACT_LIMIT,
    },
    input.traceId,
  );

  try {
    const output = await collectResearchEvidenceOperation(input, trace);
    trace.finish({
      success: output.success,
      queryCount: output.queries.length,
      sourceCount: output.sources.length,
      unavailableReason: output.unavailableReason ?? null,
    });
    return output;
  } catch (error) {
    trace.fail(error);
    throw error;
  }
}

export function formatResearchEvidenceForPrompt(
  sources: Array<
    Pick<
      ResearchEvidenceSource,
      | "sourceId"
      | "title"
      | "url"
      | "domain"
      | "sourceType"
      | "qualityTier"
      | "provider"
      | "extractProvider"
      | "publishedAt"
      | "extractedAt"
      | "extractionStatus"
      | "evidenceChunks"
      | "snippet"
    >
  >,
): string {
  if (sources.length === 0) {
    return "无可用来源。";
  }

  return sources
    .map((source, index) => {
      const sourceId = source.sourceId || `S${index + 1}`;
      const chunks =
        source.evidenceChunks.length > 0
          ? source.evidenceChunks
              .map((chunk) => `  - (${chunk.relevanceScore ?? 0}) ${chunk.text}`)
              .join("\n")
          : `  - ${source.snippet}`;

      return [
        `[${sourceId}] ${source.title}`,
        `URL: ${source.url}`,
        `Domain: ${source.domain}`,
        `Type: ${source.sourceType}; Quality: ${source.qualityTier}; Provider: ${source.provider}; Extractor: ${source.extractProvider ?? "none"}; Status: ${source.extractionStatus}`,
        source.publishedAt ? `Published: ${source.publishedAt}` : null,
        source.extractedAt ? `Extracted: ${source.extractedAt}` : null,
        "Evidence:",
        chunks,
      ]
        .filter((item): item is string => Boolean(item))
        .join("\n");
    })
    .join("\n\n");
}
