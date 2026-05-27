import "server-only";

import { createHash } from "node:crypto";
import { env } from "@/config/env";
import { getRedis } from "@/lib/redis";
import type {
  ResearchEvidenceChunk,
  ResearchExtractProvider,
  ResearchSearchProvider,
  ResearchSourceQualityTier,
  ResearchSourceType,
} from "./source-types";

const CACHE_PREFIX = "nexusnote:research:v2";
const MIN_EXTRACTED_CONTENT_LENGTH = 240;
const DEFAULT_LIMIT = 6;
const DEFAULT_EXTRACT_LIMIT = 8;
const MAX_QUERY_VARIANTS = 4;
const MAX_CACHE_VALUE_BYTES = 700_000;

const OFFICIAL_DOC_HINTS = [
  "/docs",
  "/documentation",
  "/reference",
  "/api-reference",
  "developer.",
  "developers.",
  "docs.",
];

const PRIMARY_DOMAINS = [
  "arxiv.org",
  "openreview.net",
  "aclanthology.org",
  "github.com",
  "react.dev",
  "nextjs.org",
  "developer.mozilla.org",
  "platform.openai.com",
  "openai.com",
  "anthropic.com",
  "ai.google.dev",
  "deepmind.google",
  "docs.tavily.com",
  "exa.ai",
  "docs.firecrawl.dev",
  "help.aliyun.com",
  "qwenlm.github.io",
  "deepseek.com",
  "docs.anthropic.com",
  "vercel.com",
];

const SEO_AGGREGATOR_HINTS = [
  "top ",
  "best ",
  "ultimate guide",
  "complete guide",
  "for beginners",
  "alternatives",
  "vs.",
  "comparison",
  "review",
  "reviews",
  "排行榜",
  "推荐",
  "对比",
  "合集",
  "入门指南",
];

const LOW_QUALITY_DOMAINS = [
  "medium.com",
  "dev.to",
  "hashnode.dev",
  "towardsdatascience.com",
  "analyticsvidhya.com",
  "simplilearn.com",
  "geeksforgeeks.org",
  "w3schools.com",
];

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
  errors: string[];
  providerTrace: Array<{
    provider: ResearchSearchProvider | ResearchExtractProvider | "reranker";
    status: "used" | "skipped" | "failed";
    message?: string;
  }>;
}

interface CollectResearchEvidenceInput {
  query: string;
  queries?: string[];
  focus?: string;
  limit?: number;
  maxExtractedSources?: number;
  freshnessWindowDays?: 30 | 90 | 180;
  userId?: string;
}

interface ExtractedDocument {
  url: string;
  title?: string;
  content: string;
  provider: ResearchExtractProvider;
  extractedAt: string;
}

interface RankedChunk {
  sourceIndex: number;
  chunkIndex: number;
  text: string;
  score: number;
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "unknown";
  }
}

function normalizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|yclid|mc_)/i.test(key)) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return parsed.toString().replace(/\/$/u, "");
  } catch {
    return null;
  }
}

function hashKey(parts: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function buildCacheKey(parts: unknown[]): string {
  return `${CACHE_PREFIX}:${hashKey(parts)}`;
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const cached = await getRedis().get(key);
    return cached ? (JSON.parse(cached) as T) : null;
  } catch (error) {
    if (env.APP_TRACE_LOGS) {
      console.warn("[Research] cache read failed", { key, error });
    }
    return null;
  }
}

async function writeCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    if (Buffer.byteLength(serialized, "utf8") > MAX_CACHE_VALUE_BYTES) {
      return;
    }
    await getRedis().set(key, serialized, "EX", ttlSeconds);
  } catch (error) {
    if (env.APP_TRACE_LOGS) {
      console.warn("[Research] cache write failed", { key, error });
    }
  }
}

function hasTimeSensitiveCue(query: string): boolean {
  const currentYear = new Date().getUTCFullYear();
  const currentYearPattern = new RegExp(`\\b${currentYear}\\b`, "u");
  return (
    /(最新|当前|现在|今年|today|latest|current|release|changelog|发布|前沿)/iu.test(query) ||
    currentYearPattern.test(query)
  );
}

function hasTechnicalResearchCue(query: string): boolean {
  return /(api|sdk|模型|model|framework|框架|论文|paper|benchmark|agent)/iu.test(query);
}

function getFreshnessWindowDays(query: string): 30 | 90 | 180 {
  if (hasTimeSensitiveCue(query)) {
    return 30;
  }

  if (hasTechnicalResearchCue(query)) {
    return 90;
  }

  return 180;
}

function getCacheTtlSeconds(freshnessWindowDays: 30 | 90 | 180): number {
  return freshnessWindowDays * 24 * 60 * 60;
}

function getProviderFreshnessStartDate(
  query: string,
  freshnessWindowDays: 30 | 90 | 180,
): string | null {
  if (freshnessWindowDays !== 30 || !hasTimeSensitiveCue(query)) {
    return null;
  }

  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - freshnessWindowDays);
  return startDate.toISOString().slice(0, 10);
}

function getExaSearchType(query: string): "auto" | "deep-lite" {
  return hasTimeSensitiveCue(query) || hasTechnicalResearchCue(query) ? "deep-lite" : "auto";
}

function normalizeQueryList(query: string, queries?: string[]): string[] {
  const seen = new Set<string>();
  const normalized = [query, ...(queries ?? [])]
    .map((item) => item.replace(/\s+/gu, " ").trim())
    .filter((item) => item.length > 0 && item.length <= 320)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  return normalized.slice(0, MAX_QUERY_VARIANTS);
}

function buildQueryVariants(query: string, focus?: string): string[] {
  const variants = new Set<string>([query]);
  const normalizedFocus = focus?.replace(/\s+/gu, " ").trim();

  if (normalizedFocus && !query.toLowerCase().includes(normalizedFocus.toLowerCase())) {
    variants.add(`${query} ${normalizedFocus}`);
  }

  if (hasTimeSensitiveCue(query) || hasTechnicalResearchCue(query)) {
    variants.add(`${query} official docs release notes`);
    variants.add(`${query} paper technical report github`);
  }

  return Array.from(variants).slice(0, MAX_QUERY_VARIANTS);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchJson<T>(url: string, init: RequestInit & { timeoutMs?: number }): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 12_000);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`${url} ${response.status} ${response.statusText}${text ? `: ${text}` : ""}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url: string, init: RequestInit & { timeoutMs?: number }): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 12_000);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${url} ${response.status} ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\r/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

function truncateText(value: string, maxLength: number): string {
  const clean = cleanText(value);
  if (clean.length <= maxLength) {
    return clean;
  }

  return `${clean.slice(0, maxLength - 1).trim()}…`;
}

function classifySource(
  url: string,
  title: string,
): {
  sourceType: ResearchSourceType;
  qualityTier: ResearchSourceQualityTier;
  qualityScore: number;
} {
  const normalizedUrl = url.toLowerCase();
  const normalizedTitle = title.toLowerCase();
  const domain = getDomain(url);
  const isPrimaryDomain = PRIMARY_DOMAINS.some(
    (item) => domain === item || domain.endsWith(`.${item}`),
  );
  const isOfficialDocs =
    isPrimaryDomain && OFFICIAL_DOC_HINTS.some((hint) => normalizedUrl.includes(hint));
  const isReleaseNote = /(release|changelog|releases|版本|发布)/iu.test(
    `${normalizedTitle} ${normalizedUrl}`,
  );
  const isPaper = /arxiv\.org|openreview\.net|aclanthology\.org|paper|论文/iu.test(
    `${normalizedTitle} ${normalizedUrl}`,
  );
  const isSourceCode = /github\.com|gitlab\.com|source|repository|repo/iu.test(
    `${normalizedTitle} ${normalizedUrl}`,
  );
  const isSeoAggregator =
    LOW_QUALITY_DOMAINS.some((item) => domain === item || domain.endsWith(`.${item}`)) ||
    SEO_AGGREGATOR_HINTS.some((hint) => normalizedTitle.includes(hint));

  if (isOfficialDocs) {
    return { sourceType: "official_docs", qualityTier: "primary", qualityScore: 98 };
  }

  if (isReleaseNote && isPrimaryDomain) {
    return { sourceType: "release_note", qualityTier: "primary", qualityScore: 96 };
  }

  if (isPaper) {
    return { sourceType: "paper", qualityTier: "primary", qualityScore: 94 };
  }

  if (isSourceCode) {
    return { sourceType: "source_code", qualityTier: "primary", qualityScore: 90 };
  }

  if (isPrimaryDomain) {
    return { sourceType: "official_docs", qualityTier: "primary", qualityScore: 88 };
  }

  if (
    /engineering|research|blog|技术博客|研发|实验室/iu.test(`${normalizedTitle} ${normalizedUrl}`)
  ) {
    return { sourceType: "technical_blog", qualityTier: "high", qualityScore: 74 };
  }

  if (isSeoAggregator) {
    return { sourceType: "seo_aggregator", qualityTier: "low", qualityScore: 24 };
  }

  if (/news|报道|新闻/iu.test(`${normalizedTitle} ${normalizedUrl}`)) {
    return { sourceType: "news", qualityTier: "standard", qualityScore: 52 };
  }

  if (/forum|reddit|stackoverflow|社区|讨论/iu.test(`${normalizedTitle} ${normalizedUrl}`)) {
    return { sourceType: "community", qualityTier: "standard", qualityScore: 45 };
  }

  return { sourceType: "unknown", qualityTier: "standard", qualityScore: 50 };
}

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

async function extractWithJinaReader(url: string): Promise<ExtractedDocument | null> {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    return null;
  }

  const data = await fetchText(`https://r.jina.ai/${normalizedUrl}`, {
    method: "GET",
    headers: {
      Accept: "text/plain",
      "X-Return-Format": "markdown",
      ...(env.JINA_API_KEY ? { Authorization: `Bearer ${env.JINA_API_KEY}` } : {}),
    },
    timeoutMs: 20_000,
  });
  const content = cleanText(data);

  if (content.length < MIN_EXTRACTED_CONTENT_LENGTH) {
    return null;
  }

  return {
    url: normalizedUrl,
    content,
    provider: "jina-reader",
    extractedAt: new Date().toISOString(),
  };
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

async function extractWithTavily(urls: string[]): Promise<Map<string, ExtractedDocument>> {
  if (!env.TAVILY_API_KEY || urls.length === 0) {
    return new Map();
  }

  const data = await fetchJson<Record<string, unknown>>("https://api.tavily.com/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      urls,
      extract_depth: "advanced",
      include_images: false,
    }),
    timeoutMs: 20_000,
  });

  const documents = new Map<string, ExtractedDocument>();
  const results = Array.isArray(data.results) ? data.results : [];
  for (const item of results) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const url = typeof record.url === "string" ? normalizeUrl(record.url) : null;
    const content =
      cleanText(typeof record.raw_content === "string" ? record.raw_content : "") ||
      cleanText(typeof record.content === "string" ? record.content : "");

    if (!url || content.length < MIN_EXTRACTED_CONTENT_LENGTH) {
      continue;
    }

    documents.set(url, {
      url,
      title: typeof record.title === "string" ? record.title : undefined,
      content,
      provider: "tavily-extract",
      extractedAt: new Date().toISOString(),
    });
  }

  return documents;
}

async function extractWithFirecrawl(url: string): Promise<ExtractedDocument | null> {
  if (!env.FIRECRAWL_API_KEY) {
    return null;
  }

  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    return null;
  }

  const data = await fetchJson<Record<string, unknown>>("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url: normalizedUrl,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
    timeoutMs: 25_000,
  });

  const payload =
    data.data && typeof data.data === "object" ? (data.data as Record<string, unknown>) : data;
  const content = cleanText(
    typeof payload.markdown === "string"
      ? payload.markdown
      : typeof payload.content === "string"
        ? payload.content
        : "",
  );

  if (content.length < MIN_EXTRACTED_CONTENT_LENGTH) {
    return null;
  }

  const metadata =
    payload.metadata && typeof payload.metadata === "object"
      ? (payload.metadata as Record<string, unknown>)
      : {};

  return {
    url: normalizedUrl,
    title: typeof metadata.title === "string" ? metadata.title : undefined,
    content,
    provider: "firecrawl",
    extractedAt: new Date().toISOString(),
  };
}

async function extractOne(
  result: ResearchSearchResult,
  freshnessWindowDays: 30 | 90 | 180,
): Promise<ExtractedDocument | null> {
  const normalizedUrl = normalizeUrl(result.url);
  if (!normalizedUrl) {
    return null;
  }

  if (result.text && result.text.length >= MIN_EXTRACTED_CONTENT_LENGTH) {
    return {
      url: normalizedUrl,
      title: result.title,
      content: result.text,
      provider: "exa-contents",
      extractedAt: new Date().toISOString(),
    };
  }

  const cacheKey = buildCacheKey(["extract", normalizedUrl, freshnessWindowDays]);
  const cached = await readCache<ExtractedDocument>(cacheKey);
  if (cached) {
    return cached;
  }

  let document: ExtractedDocument | null = null;

  if (env.FIRECRAWL_API_KEY) {
    document = await extractWithFirecrawl(normalizedUrl).catch(() => null);
  }

  if (!document) {
    document = await extractWithJinaReader(normalizedUrl).catch(() => null);
  }

  if (document) {
    await writeCache(cacheKey, document, getCacheTtlSeconds(freshnessWindowDays));
  }

  return document;
}

async function extractDocuments(
  results: ResearchSearchResult[],
  freshnessWindowDays: 30 | 90 | 180,
  providerTrace: ResearchRetrievalOutput["providerTrace"],
): Promise<Map<string, ExtractedDocument>> {
  const documents = new Map<string, ExtractedDocument>();
  const urlsNeedingExtraction = results
    .filter((result) => !result.text || result.text.length < MIN_EXTRACTED_CONTENT_LENGTH)
    .map((result) => normalizeUrl(result.url))
    .filter((url): url is string => url != null);

  if (env.TAVILY_API_KEY && urlsNeedingExtraction.length > 0) {
    try {
      const tavilyDocuments = await extractWithTavily(urlsNeedingExtraction);
      for (const [url, document] of tavilyDocuments) {
        documents.set(url, document);
        await writeCache(
          buildCacheKey(["extract", url, freshnessWindowDays]),
          document,
          getCacheTtlSeconds(freshnessWindowDays),
        );
      }
      providerTrace.push({
        provider: "tavily-extract",
        status: tavilyDocuments.size > 0 ? "used" : "skipped",
        message: tavilyDocuments.size > 0 ? undefined : "No extractable Tavily documents",
      });
    } catch (error) {
      providerTrace.push({
        provider: "tavily-extract",
        status: "failed",
        message: formatError(error),
      });
    }
  } else {
    providerTrace.push({
      provider: "tavily-extract",
      status: "skipped",
      message:
        urlsNeedingExtraction.length === 0 ? "No extraction targets" : "TAVILY_API_KEY missing",
    });
  }

  await Promise.all(
    results.map(async (result) => {
      const normalizedUrl = normalizeUrl(result.url);
      if (!normalizedUrl || documents.has(normalizedUrl)) {
        return;
      }

      const document = await extractOne(result, freshnessWindowDays);
      if (document) {
        documents.set(normalizedUrl, document);
      }
    }),
  );

  const usedProviders = new Set([...documents.values()].map((document) => document.provider));

  if (usedProviders.has("exa-contents")) {
    providerTrace.push({ provider: "exa-contents", status: "used" });
  }

  if (usedProviders.has("firecrawl")) {
    providerTrace.push({ provider: "firecrawl", status: "used" });
  } else if (env.FIRECRAWL_API_KEY) {
    providerTrace.push({
      provider: "firecrawl",
      status: "skipped",
      message: "No Firecrawl document extracted",
    });
  } else {
    providerTrace.push({
      provider: "firecrawl",
      status: "skipped",
      message: "FIRECRAWL_API_KEY missing",
    });
  }
  providerTrace.push({
    provider: "jina-reader",
    status: usedProviders.has("jina-reader") ? "used" : "skipped",
    message: usedProviders.has("jina-reader") ? undefined : "Not needed or no document extracted",
  });

  return documents;
}

function tokenizeQuery(query: string): string[] {
  const tokens = query.toLowerCase().match(/[a-z0-9][a-z0-9.+#-]{1,}|[\u4e00-\u9fff]{2,}/gu) ?? [];
  return Array.from(new Set(tokens)).slice(0, 32);
}

function lexicalScore(queryTokens: string[], text: string): number {
  if (queryTokens.length === 0) {
    return 0;
  }

  const normalizedText = text.toLowerCase();
  const hits = queryTokens.filter((token) => normalizedText.includes(token)).length;
  return (hits / queryTokens.length) * 100;
}

function chunkText(text: string, maxLength = 1100): string[] {
  const paragraphs = cleanText(text)
    .split(/\n{2,}/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxLength) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let index = 0; index < paragraph.length; index += maxLength) {
        chunks.push(paragraph.slice(index, index + maxLength).trim());
      }
      continue;
    }

    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length > maxLength && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = next;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.slice(0, 8);
}

async function rerankWith302Qwen(
  query: string,
  chunks: Array<{ text: string; sourceIndex: number; chunkIndex: number }>,
  topN: number,
): Promise<RankedChunk[] | null> {
  if (!env.RERANKER_ENABLED || chunks.length === 0 || !env.AI_302_API_KEY) {
    return null;
  }

  return await rerankWith302(query, chunks, topN);
}

function mapRerankResults(
  results: unknown,
  chunks: Array<{ text: string; sourceIndex: number; chunkIndex: number }>,
): RankedChunk[] | null {
  if (!Array.isArray(results)) {
    return null;
  }

  const ranked = results
    .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
    .map((item) => {
      const index = typeof item.index === "number" ? item.index : -1;
      const chunk = chunks[index];
      if (!chunk) {
        return null;
      }

      const rawScore =
        typeof item.relevance_score === "number"
          ? item.relevance_score
          : typeof item.score === "number"
            ? item.score
            : 0;

      return {
        sourceIndex: chunk.sourceIndex,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        score: rawScore <= 1 ? clampScore(rawScore * 100) : clampScore(rawScore),
      };
    })
    .filter((item): item is RankedChunk => item != null);

  return ranked.length > 0 ? ranked : null;
}

async function rerankWith302(
  query: string,
  chunks: Array<{ text: string; sourceIndex: number; chunkIndex: number }>,
  topN: number,
): Promise<RankedChunk[] | null> {
  const endpoint = `${env.AI_302_BASE_URL.replace(/\/$/u, "")}/reranks`;
  const data = await fetchJson<Record<string, unknown>>(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.AI_302_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.RERANKER_MODEL_PRO || env.RERANKER_MODEL,
      query,
      documents: chunks.map((chunk) => chunk.text),
      top_n: Math.min(topN, chunks.length),
      return_documents: false,
    }),
    timeoutMs: 20_000,
  });

  return mapRerankResults(data.results, chunks);
}

async function rankEvidenceSources(
  query: string,
  sources: Omit<ResearchEvidenceSource, "sourceId" | "relevanceScore" | "evidenceChunks">[],
  providerTrace: ResearchRetrievalOutput["providerTrace"],
): Promise<ResearchEvidenceSource[]> {
  const queryTokens = tokenizeQuery(query);
  const chunkCandidates = sources.flatMap((source, sourceIndex) =>
    chunkText(source.contentPreview || source.snippet).map((text, chunkIndex) => ({
      sourceIndex,
      chunkIndex,
      text,
    })),
  );
  const topN = Math.min(chunkCandidates.length, Math.max(8, sources.length * 3));

  let rankedChunks: RankedChunk[] | null = null;
  try {
    rankedChunks = await rerankWith302Qwen(query, chunkCandidates, topN);
    providerTrace.push({
      provider: "reranker",
      status: rankedChunks ? "used" : "skipped",
      message: rankedChunks
        ? undefined
        : "RERANKER_ENABLED=false, AI_302_API_KEY missing, or no chunks",
    });
  } catch (error) {
    providerTrace.push({ provider: "reranker", status: "failed", message: formatError(error) });
  }

  if (!rankedChunks) {
    rankedChunks = chunkCandidates
      .map((chunk) => ({
        ...chunk,
        score: clampScore(lexicalScore(queryTokens, chunk.text)),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, topN);
  }

  const chunksBySource = new Map<number, ResearchEvidenceChunk[]>();
  const relevanceBySource = new Map<number, number>();

  rankedChunks.forEach((chunk) => {
    const existingChunks = chunksBySource.get(chunk.sourceIndex) ?? [];
    if (existingChunks.length < 3) {
      existingChunks.push({
        id: `c${chunk.chunkIndex + 1}`,
        text: truncateText(chunk.text, 1500),
        relevanceScore: chunk.score,
      });
      chunksBySource.set(chunk.sourceIndex, existingChunks);
    }

    const current = relevanceBySource.get(chunk.sourceIndex) ?? 0;
    relevanceBySource.set(chunk.sourceIndex, Math.max(current, chunk.score));
  });

  return sources
    .map((source, index) => {
      const lexical = lexicalScore(
        queryTokens,
        `${source.title}\n${source.snippet}\n${source.contentPreview}`,
      );
      const rerankScore = relevanceBySource.get(index) ?? 0;
      const relevanceScore = clampScore(
        rerankScore * 0.62 + lexical * 0.18 + source.qualityScore * 0.2,
      );
      const fallbackChunk = {
        id: "c1",
        text: truncateText(source.contentPreview || source.snippet || source.title, 1400),
        relevanceScore,
      };

      return {
        ...source,
        sourceId: `S${index + 1}`,
        relevanceScore,
        evidenceChunks: chunksBySource.get(index) ?? [fallbackChunk],
      };
    })
    .sort((left, right) => {
      const scoreDiff = right.relevanceScore - left.relevanceScore;
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return right.qualityScore - left.qualityScore;
    })
    .map((source, index) => ({
      ...source,
      sourceId: `S${index + 1}`,
    }));
}

function buildEvidenceSource(params: {
  result: ResearchSearchResult;
  document: ExtractedDocument | null;
  freshnessWindowDays: 30 | 90 | 180;
  searchQuery: string;
}): Omit<ResearchEvidenceSource, "sourceId" | "relevanceScore" | "evidenceChunks"> {
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
  return Boolean(env.TAVILY_API_KEY || env.EXA_API_KEY || env.JINA_API_KEY);
}

export async function collectResearchEvidence(
  input: CollectResearchEvidenceInput,
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
    return {
      success: false,
      query,
      queries: [query],
      answer: null,
      sources: [],
      errors: ["AI_ENABLE_WEB_SEARCH=false"],
      providerTrace,
    };
  }

  if (!hasResearchProviderConfigured()) {
    return {
      success: false,
      query,
      queries: [query],
      answer: null,
      sources: [],
      errors: ["No web research provider configured"],
      providerTrace,
    };
  }

  const queries = normalizeQueryList(query, [
    ...buildQueryVariants(query, input.focus),
    ...(input.queries ?? []),
  ]);
  const searchOutputs = await Promise.all(
    queries.map((variant) => searchAcrossProviders(variant, limit, freshnessWindowDays)),
  );
  const answer = searchOutputs.find((output) => output.answer)?.answer ?? null;

  for (const output of searchOutputs) {
    errors.push(...output.errors);
    providerTrace.push(...output.providerTrace);
  }

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

  const extractionTargets = results.slice(0, maxExtractedSources);
  const documents = await extractDocuments(extractionTargets, freshnessWindowDays, providerTrace);

  const sourcesWithoutRank = results.map((result) =>
    buildEvidenceSource({
      result,
      document: documents.get(result.url) ?? null,
      freshnessWindowDays,
      searchQuery: query,
    }),
  );

  const rankedSources = await rankEvidenceSources(query, sourcesWithoutRank, providerTrace);
  const sources = rankedSources.slice(0, limit);

  return {
    success: sources.length > 0,
    query,
    queries,
    answer,
    sources,
    errors,
    providerTrace,
  };
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
