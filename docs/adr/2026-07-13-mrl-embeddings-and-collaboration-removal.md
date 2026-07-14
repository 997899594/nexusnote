# ADR: Adopt MRL Embeddings and Remove Dormant Collaboration Runtime

## Status

Accepted on 2026-07-13.

## Context

The repository carried PartyKit, Yjs, and y-partykit without a client integration, authentication,
tenant isolation, or an operational deployment contract. The unused runtime increased dependency
and attack surface without providing a product capability.

RAG used Qwen3 Embedding at 4096 dimensions while the active PostgreSQL type was `vector(4096)`.
pgvector HNSW supports at most 2000 dimensions for `vector`, so the documented HNSW indexes could
not exist for that schema. Embedding dimensions were also implicit at model call sites.

## Decision

- Remove PartyKit, Yjs, y-partykit, the PartyKit server, its command, and the unused Yjs snapshot
  column.
- Keep Tiptap as the single-user editor. Realtime collaboration can only return with an explicit
  authenticated and tenant-isolated design.
- Use Qwen3 Embedding MRL at 1536 dimensions.
- Keep PostgreSQL + pgvector as the retrieval store.
- Use native Drizzle `vector(1536)` columns with cosine HNSW indexes configured as `m=16` and
  `ef_construction=64`.
- Route every embedding call through one module that sends `dimensions=1536` and rejects a model
  response with a different width.

## Consequences

### Positive

- Removes the unused edge runtime and its transitive vulnerabilities.
- Reduces vector storage and distance computation by 62.5% relative to 4096 dimensions.
- Makes approximate nearest-neighbor search available through pgvector HNSW.
- Prevents silent model/schema dimension drift.

### Negative

- Existing database columns require an explicit type migration before the new application is
  deployed.
- Realtime collaborative editing will require a new implementation if it becomes a product goal.
- A dimension change requires rebuilding both HNSW indexes.

## Database Transition

This repository keeps Drizzle schema authoring as its source of truth and does not execute fallback
migrations from runtime images. The deployment platform must apply the following transition before
starting the new web and worker revisions:

1. Stop RAG writers for the maintenance window.
2. Drop the two existing vector indexes if present.
3. Alter both vector columns to `vector(1536)`, using the first 1536 MRL dimensions of non-null
   values via `subvector(..., 1, 1536)::vector(1536)`.
4. Drop `note_snapshots.yjs_state`.
5. Create the cosine HNSW indexes declared in Drizzle schema.
6. Deploy web and workers together, then resume RAG writers.

The platform migration must be equivalent to:

```sql
BEGIN;

DROP INDEX IF EXISTS knowledge_evidence_chunks_embedding_hnsw_idx;
DROP INDEX IF EXISTS tags_name_embedding_hnsw_idx;

ALTER TABLE knowledge_evidence_chunks
  ALTER COLUMN embedding TYPE vector(1536)
  USING subvector(embedding, 1, 1536)::vector(1536);

ALTER TABLE tags
  ALTER COLUMN name_embedding TYPE vector(1536)
  USING subvector(name_embedding, 1, 1536)::vector(1536);

ALTER TABLE note_snapshots DROP COLUMN IF EXISTS yjs_state;

CREATE INDEX knowledge_evidence_chunks_embedding_hnsw_idx
  ON knowledge_evidence_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX tags_name_embedding_hnsw_idx
  ON tags
  USING hnsw (name_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMIT;
```

The MRL prefix preserves the existing Qwen3 embedding signal; normalizing the stored prefix is not
required for cosine distance. A full re-embedding can run later to validate retrieval quality, but
is not required for the cutover.

## Alternatives Considered

### Keep PartyKit as an optional runtime

Rejected because an unauthenticated, unintegrated runtime is not a product capability and retains
operational and security cost.

### Use `halfvec(4096)`

Rejected because it keeps excessive dimensionality and storage while only working around the HNSW
limit.

### Use `vector(2000)`

Rejected in favor of 1536 dimensions because the additional 464 dimensions increase storage and
distance work by roughly 30% without evidence of a material recall improvement for this workload.

### Add an external vector database

Rejected because PostgreSQL already owns the evidence lifecycle and pgvector satisfies the current
retrieval scale without a second consistency boundary.
