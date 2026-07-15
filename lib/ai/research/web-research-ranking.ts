import { env } from "@/config/env";
import type { ResearchEvidenceChunk } from "./source-types";
import type {
  ResearchEvidenceSource,
  ResearchRetrievalOutput,
  UnrankedResearchEvidenceSource,
} from "./web-research-contracts";
import {
  clampScore,
  cleanText,
  fetchJson,
  formatError,
  truncateText,
} from "./web-research-foundation";

interface RankedChunk {
  sourceIndex: number;
  chunkIndex: number;
  text: string;
  score: number;
}

function tokenizeQuery(query: string): string[] {
  const tokens = query.toLowerCase().match(/[a-z0-9][a-z0-9.+#-]{1,}|[\u4e00-\u9fff]{2,}/gu) ?? [];
  return Array.from(new Set(tokens)).slice(0, 32);
}

function lexicalScore(queryTokens: string[], text: string): number {
  if (queryTokens.length === 0) return 0;
  const normalizedText = text.toLowerCase();
  return (
    (queryTokens.filter((token) => normalizedText.includes(token)).length / queryTokens.length) *
    100
  );
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
      if (current) chunks.push(current);
      current = "";
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
  if (current) chunks.push(current);
  return chunks.slice(0, 8);
}

function mapRerankResults(
  results: unknown,
  chunks: Array<{ text: string; sourceIndex: number; chunkIndex: number }>,
): RankedChunk[] | null {
  if (!Array.isArray(results)) return null;
  const ranked = results
    .filter((item): item is Record<string, unknown> => item != null && typeof item === "object")
    .map((item) => {
      const chunk = chunks[typeof item.index === "number" ? item.index : -1];
      if (!chunk) return null;
      const rawScore =
        typeof item.relevance_score === "number"
          ? item.relevance_score
          : typeof item.score === "number"
            ? item.score
            : 0;
      return { ...chunk, score: rawScore <= 1 ? clampScore(rawScore * 100) : clampScore(rawScore) };
    })
    .filter((item): item is RankedChunk => item != null);
  return ranked.length > 0 ? ranked : null;
}

async function rerank(
  query: string,
  chunks: Array<{ text: string; sourceIndex: number; chunkIndex: number }>,
  topN: number,
): Promise<RankedChunk[] | null> {
  if (!env.RERANKER_ENABLED || chunks.length === 0 || !env.AI_302_API_KEY) return null;
  const data = await fetchJson<Record<string, unknown>>(
    `${env.AI_302_BASE_URL.replace(/\/$/u, "")}/reranks`,
    {
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
    },
  );
  return mapRerankResults(data.results, chunks);
}

export async function rankResearchEvidenceSources(
  query: string,
  sources: UnrankedResearchEvidenceSource[],
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
    rankedChunks = await rerank(query, chunkCandidates, topN);
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

  rankedChunks ??= chunkCandidates
    .map((chunk) => ({ ...chunk, score: clampScore(lexicalScore(queryTokens, chunk.text)) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, topN);

  const chunksBySource = new Map<number, ResearchEvidenceChunk[]>();
  const relevanceBySource = new Map<number, number>();
  const maxChunksPerSource = env.CONTEXT_COMPRESSION_ENABLED ? 2 : 3;
  const maxChunkLength = env.CONTEXT_COMPRESSION_ENABLED ? 900 : 1500;

  for (const chunk of rankedChunks) {
    const existing = chunksBySource.get(chunk.sourceIndex) ?? [];
    if (existing.length < maxChunksPerSource) {
      existing.push({
        id: `c${chunk.chunkIndex + 1}`,
        text: truncateText(chunk.text, maxChunkLength),
        relevanceScore: chunk.score,
      });
      chunksBySource.set(chunk.sourceIndex, existing);
    }
    relevanceBySource.set(
      chunk.sourceIndex,
      Math.max(relevanceBySource.get(chunk.sourceIndex) ?? 0, chunk.score),
    );
  }

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
      return {
        ...source,
        sourceId: `S${index + 1}`,
        relevanceScore,
        evidenceChunks: chunksBySource.get(index) ?? [
          {
            id: "c1",
            text: truncateText(source.contentPreview || source.snippet || source.title, 1400),
            relevanceScore,
          },
        ],
      };
    })
    .sort(
      (left, right) =>
        right.relevanceScore - left.relevanceScore || right.qualityScore - left.qualityScore,
    )
    .map((source, index) => ({ ...source, sourceId: `S${index + 1}` }));
}
