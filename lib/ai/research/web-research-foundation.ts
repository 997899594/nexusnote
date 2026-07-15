import { createHash } from "node:crypto";
import { env } from "@/config/env";
import { getRedis } from "@/lib/redis";
import type { ResearchSourceQualityTier, ResearchSourceType } from "./source-types";

const CACHE_PREFIX = "nexusnote:research:v2";
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

export const MIN_EXTRACTED_CONTENT_LENGTH = 240;

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "unknown";
  }
}

export function normalizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|yclid|mc_)/i.test(key)) parsed.searchParams.delete(key);
    }
    parsed.hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return parsed.toString().replace(/\/$/u, "");
  } catch {
    return null;
  }
}

export function buildCacheKey(parts: unknown[]): string {
  const hash = createHash("sha256").update(JSON.stringify(parts)).digest("hex");
  return `${CACHE_PREFIX}:${hash}`;
}

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const cached = await getRedis().get(key);
    return cached ? (JSON.parse(cached) as T) : null;
  } catch (error) {
    if (env.APP_TRACE_LOGS) console.warn("[Research] cache read failed", { key, error });
    return null;
  }
}

export async function writeCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    if (Buffer.byteLength(serialized, "utf8") > MAX_CACHE_VALUE_BYTES) return;
    await getRedis().set(key, serialized, "EX", ttlSeconds);
  } catch (error) {
    if (env.APP_TRACE_LOGS) console.warn("[Research] cache write failed", { key, error });
  }
}

function hasTimeSensitiveCue(query: string): boolean {
  const currentYear = new Date().getUTCFullYear();
  return (
    /(最新|当前|现在|今年|today|latest|current|release|changelog|发布|前沿)/iu.test(query) ||
    new RegExp(`\\b${currentYear}\\b`, "u").test(query)
  );
}

function hasTechnicalResearchCue(query: string): boolean {
  return /(api|sdk|模型|model|framework|框架|论文|paper|benchmark|agent)/iu.test(query);
}

export function getFreshnessWindowDays(query: string): 30 | 90 | 180 {
  if (hasTimeSensitiveCue(query)) return 30;
  if (hasTechnicalResearchCue(query)) return 90;
  return 180;
}

export function getCacheTtlSeconds(days: 30 | 90 | 180): number {
  return days * 24 * 60 * 60;
}

export function getProviderFreshnessStartDate(query: string, days: 30 | 90 | 180): string | null {
  if (days !== 30 || !hasTimeSensitiveCue(query)) return null;
  const startDate = new Date();
  startDate.setUTCDate(startDate.getUTCDate() - days);
  return startDate.toISOString().slice(0, 10);
}

export function getExaSearchType(query: string): "auto" | "deep-lite" {
  return hasTimeSensitiveCue(query) || hasTechnicalResearchCue(query) ? "deep-lite" : "auto";
}

export function getAi302Origin(): string {
  try {
    return new URL(env.AI_302_BASE_URL).origin;
  } catch {
    return "https://api.302ai.cn";
  }
}

export function normalizeQueryList(query: string, queries?: string[]): string[] {
  const seen = new Set<string>();
  return [query, ...(queries ?? [])]
    .map((item) => item.replace(/\s+/gu, " ").trim())
    .filter((item) => item.length > 0 && item.length <= 320)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_QUERY_VARIANTS);
}

export function buildQueryVariants(query: string, focus?: string): string[] {
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

export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 12_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`${url} ${response.status} ${response.statusText}${text ? `: ${text}` : ""}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchText(
  url: string,
  init: RequestInit & { timeoutMs?: number },
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 12_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`${url} ${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export function cleanText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\r/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

export function truncateText(value: string, maxLength: number): string {
  const clean = cleanText(value);
  return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength - 1).trim()}…`;
}

export function classifySource(
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
  const primary = PRIMARY_DOMAINS.some((item) => domain === item || domain.endsWith(`.${item}`));
  const official = primary && OFFICIAL_DOC_HINTS.some((hint) => normalizedUrl.includes(hint));
  const release = /(release|changelog|releases|版本|发布)/iu.test(
    `${normalizedTitle} ${normalizedUrl}`,
  );
  const paper = /arxiv\.org|openreview\.net|aclanthology\.org|paper|论文/iu.test(
    `${normalizedTitle} ${normalizedUrl}`,
  );
  const sourceCode = /github\.com|gitlab\.com|source|repository|repo/iu.test(
    `${normalizedTitle} ${normalizedUrl}`,
  );
  const aggregator =
    LOW_QUALITY_DOMAINS.some((item) => domain === item || domain.endsWith(`.${item}`)) ||
    SEO_AGGREGATOR_HINTS.some((hint) => normalizedTitle.includes(hint));

  if (official) return { sourceType: "official_docs", qualityTier: "primary", qualityScore: 98 };
  if (release && primary)
    return { sourceType: "release_note", qualityTier: "primary", qualityScore: 96 };
  if (paper) return { sourceType: "paper", qualityTier: "primary", qualityScore: 94 };
  if (sourceCode) return { sourceType: "source_code", qualityTier: "primary", qualityScore: 90 };
  if (primary) return { sourceType: "official_docs", qualityTier: "primary", qualityScore: 88 };
  if (
    /engineering|research|blog|技术博客|研发|实验室/iu.test(`${normalizedTitle} ${normalizedUrl}`)
  ) {
    return { sourceType: "technical_blog", qualityTier: "high", qualityScore: 74 };
  }
  if (aggregator) return { sourceType: "seo_aggregator", qualityTier: "low", qualityScore: 24 };
  if (/news|报道|新闻/iu.test(`${normalizedTitle} ${normalizedUrl}`)) {
    return { sourceType: "news", qualityTier: "standard", qualityScore: 52 };
  }
  if (/forum|reddit|stackoverflow|社区|讨论/iu.test(`${normalizedTitle} ${normalizedUrl}`)) {
    return { sourceType: "community", qualityTier: "standard", qualityScore: 45 };
  }
  return { sourceType: "unknown", qualityTier: "standard", qualityScore: 50 };
}
