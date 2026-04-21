/**
 * RAG Service - Hybrid Search
 *
 * Combines vector search + keyword search + RRF merging + Query Rewriter
 * Supports multiple sources: note | capture | conversation | course_section
 */

import { embedMany } from "ai";
import type { SQL } from "drizzle-orm";
import { db, sql } from "@/db";
import { aiProvider } from "@/lib/ai/core/provider";
import type { SourceType } from "./chunker";
import { createRagTrace } from "./observability";
import { rewriteQuery } from "./query-rewriter";

const KEYWORD_SEGMENTER = new Intl.Segmenter("zh-Hans", { granularity: "word" });
const CJK_CHAR_PATTERN = /\p{Script=Han}/u;
const LATIN_OR_NUMBER_PATTERN = /[\p{Script=Latin}\p{N}]/u;
const PUNCTUATION_ONLY_PATTERN = /^[\p{P}\p{S}\s]+$/u;
// Bounds SQL predicate fan-out for lexical fallback; this is a query-shape guardrail, not a domain rule.
const MAX_LEXICAL_TERMS = 8;
// Standard reciprocal rank fusion constant.
const RRF_K = 60;

export interface HybridSearchResult {
  id: string;
  sourceId: string;
  sourceType: SourceType;
  content: string;
  score: number;
  source: "vector" | "keyword" | "both";
}

export interface HybridSearchOptions {
  topK?: number;
  sourceTypes?: SourceType[];
  userId?: string;
  conversationContext?: string;
}

interface KeywordSearchPlan {
  normalizedQuery: string;
  phraseTerms: string[];
  lexicalTerms: string[];
  fullTextQuery: string | null;
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeLexicalToken(token: string): string {
  return token.trim().toLowerCase();
}

function isUsefulLexicalTerm(term: string): boolean {
  if (!term || PUNCTUATION_ONLY_PATTERN.test(term)) {
    return false;
  }

  if (CJK_CHAR_PATTERN.test(term)) {
    return term.length >= 2;
  }

  return term.length >= 2;
}

function buildKeywordSearchPlan(query: string): KeywordSearchPlan {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  const hasCjk = CJK_CHAR_PATTERN.test(normalizedQuery);

  const segmentedTerms = [...KEYWORD_SEGMENTER.segment(normalizedQuery)]
    .map((segment) => normalizeLexicalToken(segment.segment))
    .filter((term) => isUsefulLexicalTerm(term));

  const splitTerms = normalizedQuery
    .split(/\s+/)
    .map((term) => normalizeLexicalToken(term))
    .filter((term) => isUsefulLexicalTerm(term));

  const lexicalTerms = uniqueValues([...segmentedTerms, ...splitTerms])
    .filter((term) => term !== normalizedQuery && term !== compactQuery)
    .slice(0, MAX_LEXICAL_TERMS);

  const phraseTerms = uniqueValues(
    [compactQuery, normalizedQuery]
      .map((term) => normalizeLexicalToken(term))
      .filter((term) => isUsefulLexicalTerm(term)),
  );

  const fullTextTerms = lexicalTerms.filter((term) => LATIN_OR_NUMBER_PATTERN.test(term));
  const fullTextQuery =
    fullTextTerms.length > 0
      ? fullTextTerms.join(" ")
      : !hasCjk && LATIN_OR_NUMBER_PATTERN.test(normalizedQuery) && normalizedQuery.length >= 2
        ? normalizedQuery
        : null;

  return {
    normalizedQuery,
    phraseTerms,
    lexicalTerms,
    fullTextQuery,
  };
}

function buildContentContainsPredicate(term: string) {
  return sql`POSITION(LOWER(${term}) IN LOWER(kec.content)) > 0`;
}

function buildBooleanMatchExpression(predicate: SQL) {
  return sql`CASE WHEN ${predicate} THEN 1 ELSE 0 END`;
}

async function vectorSearch(
  query: string,
  topK: number,
  sourceTypes?: SourceType[],
  userId?: string,
): Promise<
  Array<{
    id: string;
    sourceId: string;
    sourceType: SourceType;
    content: string;
    similarity: number;
  }>
> {
  if (!aiProvider.isConfigured()) {
    console.warn("[RAG] Provider not configured, skipping vector search");
    return [];
  }

  try {
    const { embeddings } = await embedMany({
      model: aiProvider.embeddingModel,
      values: [query],
    });

    const queryEmbedding = embeddings[0];
    if (!queryEmbedding) return [];

    const sourceTypeFilter =
      sourceTypes && sourceTypes.length > 0
        ? sql`AND ke.source_type IN (${sql.join(
            sourceTypes.map((sourceType) => sql`${sourceType}`),
            sql`, `,
          )})`
        : sql``;

    const userFilter = userId ? sql`AND ke.user_id = ${userId}` : sql``;

    const results = await db.execute<{
      id: string;
      source_id: string;
      source_type: SourceType;
      content: string;
      similarity: number;
    }>(sql`
      SELECT
        kec.id,
        ke.source_id,
        ke.source_type,
        kec.content,
        1 - (kec.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM knowledge_evidence_chunks kec
      INNER JOIN knowledge_evidence ke ON ke.id = kec.knowledge_evidence_id
      WHERE kec.embedding IS NOT NULL
      ${sourceTypeFilter}
      ${userFilter}
      ORDER BY kec.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${topK}
    `);

    return results.map((r) => ({
      id: r.id,
      sourceId: r.source_id,
      sourceType: r.source_type,
      content: r.content,
      similarity: r.similarity,
    }));
  } catch (error) {
    console.error("[RAG] vectorSearch error:", error);
    return [];
  }
}

async function keywordSearch(
  query: string,
  topK: number,
  sourceTypes?: SourceType[],
  userId?: string,
): Promise<
  Array<{ id: string; sourceId: string; sourceType: SourceType; content: string; rank: number }>
> {
  try {
    const plan = buildKeywordSearchPlan(query);
    if (!plan.normalizedQuery) {
      return [];
    }

    const sourceTypeFilter =
      sourceTypes && sourceTypes.length > 0
        ? sql`AND ke.source_type IN (${sql.join(
            sourceTypes.map((sourceType) => sql`${sourceType}`),
            sql`, `,
          )})`
        : sql``;

    const userFilter = userId ? sql`AND ke.user_id = ${userId}` : sql``;
    const matchPredicates: SQL[] = [];
    const phrasePredicates = plan.phraseTerms.map((term) => buildContentContainsPredicate(term));
    const lexicalPredicates = plan.lexicalTerms.map((term) => buildContentContainsPredicate(term));

    matchPredicates.push(...phrasePredicates, ...lexicalPredicates);

    const fullTextQuery = plan.fullTextQuery
      ? sql`plainto_tsquery('simple', ${plan.fullTextQuery})`
      : null;
    const fullTextMatch = fullTextQuery
      ? sql`to_tsvector('simple', kec.content) @@ ${fullTextQuery}`
      : null;
    const fullTextRankExpression = fullTextQuery
      ? sql`CASE WHEN ${fullTextMatch} THEN ts_rank_cd(to_tsvector('simple', kec.content), ${fullTextQuery}) ELSE 0 END`
      : sql`0`;

    if (fullTextMatch) {
      matchPredicates.push(fullTextMatch);
    }

    if (matchPredicates.length === 0) {
      return [];
    }

    const whereClause = sql`(${sql.join(matchPredicates, sql` OR `)})`;
    const coverageExpressions = [...phrasePredicates, ...lexicalPredicates].map((predicate) =>
      buildBooleanMatchExpression(predicate),
    );
    const coverageExpression =
      coverageExpressions.length > 0 ? sql`(${sql.join(coverageExpressions, sql` + `)})` : sql`0`;

    const results = await db.execute<{
      id: string;
      source_id: string;
      source_type: SourceType;
      content: string;
      coverage_score: number;
      full_text_rank: number;
    }>(sql`
      SELECT
        kec.id,
        ke.source_id,
        ke.source_type,
        kec.content,
        ${coverageExpression} as coverage_score,
        ${fullTextRankExpression} as full_text_rank
      FROM knowledge_evidence_chunks kec
      INNER JOIN knowledge_evidence ke ON ke.id = kec.knowledge_evidence_id
      WHERE ${whereClause}
      ${sourceTypeFilter}
      ${userFilter}
      ORDER BY coverage_score DESC, full_text_rank DESC
      LIMIT ${topK}
    `);

    return results.map((r) => ({
      id: r.id,
      sourceId: r.source_id,
      sourceType: r.source_type,
      content: r.content,
      rank: r.coverage_score + r.full_text_rank,
    }));
  } catch (error) {
    console.error("[RAG] keywordSearch error:", error);
    return [];
  }
}

function reciprocalRankFusion(
  vectorResults: Array<{ id: string; sourceId: string; sourceType: SourceType; content: string }>,
  keywordResults: Array<{ id: string; sourceId: string; sourceType: SourceType; content: string }>,
  topK: number,
): HybridSearchResult[] {
  const scores = new Map<string, { score: number; result: HybridSearchResult }>();

  vectorResults.forEach((result, rank) => {
    scores.set(result.id, {
      score: 1 / (RRF_K + rank + 1),
      result: {
        id: result.id,
        sourceId: result.sourceId,
        sourceType: result.sourceType,
        content: result.content,
        score: 0,
        source: "vector",
      },
    });
  });

  keywordResults.forEach((result, rank) => {
    const existing = scores.get(result.id);
    const rrfScore = 1 / (RRF_K + rank + 1);

    if (existing) {
      existing.score += rrfScore;
      existing.result.source = "both";
    } else {
      scores.set(result.id, {
        score: rrfScore,
        result: {
          id: result.id,
          sourceId: result.sourceId,
          sourceType: result.sourceType,
          content: result.content,
          score: 0,
          source: "keyword",
        },
      });
    }
  });

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => ({ ...s.result, score: s.score }));
}

export async function hybridSearch(
  queryOrOptions: string | (HybridSearchOptions & { query: string }),
  topKOrUndefined?: number,
  conversationContextOrUndefined?: string,
): Promise<HybridSearchResult[]> {
  let query: string;
  let options: HybridSearchOptions = {};

  if (typeof queryOrOptions === "string") {
    query = queryOrOptions;
    options = { topK: topKOrUndefined ?? 5, conversationContext: conversationContextOrUndefined };
  } else {
    query = queryOrOptions.query;
    options = queryOrOptions;
  }

  const { topK: k = 5, sourceTypes, userId, conversationContext: ctx } = options;
  const trace = createRagTrace("hybrid-search", {
    query,
    topK: k,
    sourceTypes: sourceTypes ?? null,
    hasUserId: Boolean(userId),
    hasConversationContext: Boolean(ctx),
  });

  try {
    const rewrittenQuery = await rewriteQuery(query, ctx);
    trace.step("rewrite", {
      rewrittenQuery,
      queryChanged: rewrittenQuery !== query,
    });

    const [vResults, kResults] = await Promise.all([
      vectorSearch(rewrittenQuery, k * 2, sourceTypes, userId),
      keywordSearch(rewrittenQuery, k * 2, sourceTypes, userId),
    ]);
    trace.step("retrieval", {
      vectorHits: vResults.length,
      keywordHits: kResults.length,
    });

    const fusedResults = reciprocalRankFusion(vResults, kResults, k);
    trace.finish({
      resultCount: fusedResults.length,
      topSourceTypes: fusedResults.slice(0, 3).map((item) => item.sourceType),
    });

    return fusedResults;
  } catch (error) {
    trace.fail(error);
    throw error;
  }
}
