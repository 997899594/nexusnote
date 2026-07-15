import { env } from "@/config/env";
import type {
  ExtractedDocument,
  ResearchRetrievalOutput,
  ResearchSearchResult,
} from "./web-research-contracts";
import {
  buildCacheKey,
  cleanText,
  fetchJson,
  fetchText,
  formatError,
  getCacheTtlSeconds,
  MIN_EXTRACTED_CONTENT_LENGTH,
  normalizeUrl,
  readCache,
  writeCache,
} from "./web-research-foundation";

async function extractWithJinaReader(url: string): Promise<ExtractedDocument | null> {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) return null;

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
  if (content.length < MIN_EXTRACTED_CONTENT_LENGTH) return null;

  return {
    url: normalizedUrl,
    content,
    provider: "jina-reader",
    extractedAt: new Date().toISOString(),
  };
}

async function extractWithTavily(urls: string[]): Promise<Map<string, ExtractedDocument>> {
  if (!env.TAVILY_API_KEY || urls.length === 0) return new Map();

  const data = await fetchJson<Record<string, unknown>>("https://api.tavily.com/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({ urls, extract_depth: "advanced", include_images: false }),
    timeoutMs: 20_000,
  });
  const documents = new Map<string, ExtractedDocument>();

  for (const item of Array.isArray(data.results) ? data.results : []) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const url = typeof record.url === "string" ? normalizeUrl(record.url) : null;
    const content =
      cleanText(typeof record.raw_content === "string" ? record.raw_content : "") ||
      cleanText(typeof record.content === "string" ? record.content : "");
    if (!url || content.length < MIN_EXTRACTED_CONTENT_LENGTH) continue;
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
  if (!env.FIRECRAWL_API_KEY) return null;
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) return null;

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
  if (content.length < MIN_EXTRACTED_CONTENT_LENGTH) return null;
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
  if (!normalizedUrl) return null;
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
  if (cached) return cached;

  const document =
    (env.FIRECRAWL_API_KEY ? await extractWithFirecrawl(normalizedUrl).catch(() => null) : null) ??
    (await extractWithJinaReader(normalizedUrl).catch(() => null));
  if (document) await writeCache(cacheKey, document, getCacheTtlSeconds(freshnessWindowDays));
  return document;
}

export async function extractResearchDocuments(
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
      if (!normalizedUrl || documents.has(normalizedUrl)) return;
      const document = await extractOne(result, freshnessWindowDays);
      if (document) documents.set(normalizedUrl, document);
    }),
  );

  const usedProviders = new Set([...documents.values()].map((document) => document.provider));
  if (usedProviders.has("exa-contents")) {
    providerTrace.push({ provider: "exa-contents", status: "used" });
  }
  if (usedProviders.has("firecrawl")) {
    providerTrace.push({ provider: "firecrawl", status: "used" });
  } else {
    providerTrace.push({
      provider: "firecrawl",
      status: "skipped",
      message: env.FIRECRAWL_API_KEY
        ? "No Firecrawl document extracted"
        : "FIRECRAWL_API_KEY missing",
    });
  }
  providerTrace.push({
    provider: "jina-reader",
    status: usedProviders.has("jina-reader") ? "used" : "skipped",
    message: usedProviders.has("jina-reader") ? undefined : "Not needed or no document extracted",
  });
  return documents;
}
