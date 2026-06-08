# ADR: Course Research Evidence Router

Date: 2026-06-05

## Status

Accepted

## Context

Course generation has two different freshness problems:

- The interview outline may need current product, model, competitor, pricing, release, or ecosystem
  evidence before a blueprint is trustworthy.
- A later course section can need narrower evidence than the outline. Reusing only outline
  citations is insufficient for sections that discuss concrete product capabilities, versions,
  alternatives, pricing, or recent examples.

Mature open-source RAG frameworks solve adjacent pieces, not the complete product policy:

- LangChain-style routing provides a pattern for selecting a downstream chain/retriever from a
  structured decision.
- LlamaIndex `RouterQueryEngine` provides a pattern for routing a query to one or more query engines.
- Haystack `ConditionalRouter` provides a pattern for branching pipelines by conditions.
- RAG evaluation tools such as Ragas provide metrics for retrieval quality and groundedness.

They do not replace NexusNote's domain decision: whether a specific course or section requires
fresh, official, or market evidence. That is product behavior and must be observable in our own
contracts.

## Decision

Use a NexusNote evidence router with a structured plan, not a keyword-only decision. The shared
entry point is `research/evidence-planner.ts`; interview and section drafting both call it. Cheap
lexical signals live in `research/evidence-signals.ts` and only produce candidate signals plus a
deterministic fallback for clearly fresh domains. The authoritative object is
`ResearchEvidenceRequest.plan`, which records:

- `freshnessProfile`: stable/current/frontier,
- `retrievalMode`: targeted/deep,
- `sourceTypes`: official docs, release notes, papers, source code, technical blogs, or news,
- `rationale`: why this course or section needs evidence.

The router has two gates:

1. Outline gate:
   - Resolve a structured `ResearchEvidenceRequest` from recent interview intent through the shared
     planner.
   - Build candidate signals for clear freshness domains such as current AI products, competitors,
     official docs, versions, releases, pricing, and ecosystem changes.
   - Ask the structured model planner whenever the topic has freshness, technology, product, market,
     or ambiguous currentness signals. Deterministic policy fallback is used when the planner is
     unavailable or when a clearly fresh domain still needs a safe request.
   - Emit data parts with request, progress, and final sources so the UI does not infer behavior from
     assistant text.
2. Section gate:
   - Before background section drafting, build a section-specific probe from course, chapter, section,
     and existing outline citations.
   - Run the same shared planner for the section probe, so section-level freshness is not limited to
     the original outline citations.
   - Run section retrieval only when the planner returns a request.
   - Use `retrievalMode` to control source budget: targeted for narrow official checks, deep for
     product/competitor/ecosystem comparisons.
   - Inject section evidence into the section generation prompt separately from outline citations.
   - If retrieval is unavailable, instruct the model to mark uncertain facts as needing verification
     instead of inventing current details.

The retrieval provider layer remains `research/web-research.ts`. It already handles provider fanout,
cache, extraction, dedupe, reranking, and prompt formatting. The router owns when retrieval is needed;
the provider layer owns how evidence is collected.

## Consequences

This avoids turning every course section into a web search, so stable topics keep the old low-latency
path. High-freshness sections pay extra latency, but only when they need it, and provider cache
reduces repeat cost across regenerated or adjacent sections.

The architecture remains compatible with LangChain/LlamaIndex/Haystack later because the product
boundary is now explicit: `ResearchEvidenceRequest` in, `ResearchRetrievalOutput` out. If we adopt a
framework, it should replace orchestration internals behind that boundary, not leak framework
objects into UI, course storage, or worker contracts.

This is not the final quality ceiling. The next layer should be eval-driven:

- freshness routing precision and recall,
- source quality and citation coverage,
- section groundedness against retrieved evidence,
- latency budgets for stable vs high-freshness sections.

If those evals show orchestration complexity growing, the right migration is to replace internals of
the router/provider boundary with LangChain/LlamaIndex/Haystack patterns. The external contract
should remain NexusNote-native because course freshness, section coverage, and learning quality are
product semantics, not framework semantics.
