import { env } from "@/config/env";
import type { HybridSearchResult } from "@/lib/rag/hybrid-search";

const QUERY_SEGMENTER = new Intl.Segmenter("zh-Hans", { granularity: "word" });
const MAX_CONTEXT_CHARS_PER_RESULT = 900;

export interface RagCompressionStats {
  enabled: boolean;
  inputChars: number;
  outputChars: number;
}

function getQueryTerms(query: string): string[] {
  return [...QUERY_SEGMENTER.segment(query.toLocaleLowerCase("zh-CN"))]
    .map((segment) => segment.segment.trim())
    .filter((term) => term.length >= 2)
    .filter((term, index, terms) => terms.indexOf(term) === index)
    .slice(0, 12);
}

function compressContent(content: string, terms: string[]): string {
  if (content.length <= MAX_CONTEXT_CHARS_PER_RESULT) return content;

  const segments = content
    .split(/(?<=[。！？.!?])\s*|\n+/u)
    .map((text, index) => ({ index, text: text.trim() }))
    .filter((segment) => segment.text.length > 0)
    .map((segment) => ({
      ...segment,
      score: terms.reduce(
        (score, term) => score + (segment.text.toLocaleLowerCase("zh-CN").includes(term) ? 1 : 0),
        0,
      ),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const selected: typeof segments = [];
  let selectedChars = 0;
  for (const segment of segments) {
    if (selectedChars + segment.text.length > MAX_CONTEXT_CHARS_PER_RESULT && selected.length > 0) {
      continue;
    }
    selected.push(segment);
    selectedChars += segment.text.length;
    if (selectedChars >= MAX_CONTEXT_CHARS_PER_RESULT) break;
  }

  return selected
    .sort((left, right) => left.index - right.index)
    .map((segment) => segment.text)
    .join("\n")
    .slice(0, MAX_CONTEXT_CHARS_PER_RESULT);
}

export function compressHybridSearchContext(
  query: string,
  results: HybridSearchResult[],
): { results: HybridSearchResult[]; stats: RagCompressionStats } {
  const inputChars = results.reduce((total, result) => total + result.content.length, 0);
  if (!env.CONTEXT_COMPRESSION_ENABLED) {
    return {
      results,
      stats: { enabled: false, inputChars, outputChars: inputChars },
    };
  }

  const terms = getQueryTerms(query);
  const compressed = results.map((result) => ({
    ...result,
    content: compressContent(result.content, terms),
  }));
  return {
    results: compressed,
    stats: {
      enabled: true,
      inputChars,
      outputChars: compressed.reduce((total, result) => total + result.content.length, 0),
    },
  };
}
