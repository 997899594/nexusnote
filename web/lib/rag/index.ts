/**
 * RAG Service - Public API
 *
 * Retrieval-Augmented Generation service layer for knowledge indexing
 * and hybrid search across documents and conversations.
 */

export * from "./chunker";
export * from "./hybrid-search";
export * from "./query-rewriter";

// Semantic chunking
export {
  type SemanticChunk,
  type SemanticChunkOptions,
  semanticChunk,
  semanticChunkConversation,
} from "./semantic-chunker";

// Cosine similarity utility
export { cosineSimilarity } from "./utils/cosine-similarity";
