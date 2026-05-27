# ADR: Research Evidence Boundary

Date: 2026-05-27

## Status

Accepted

## Context

Interview and chat flows both need current external evidence, but the trigger must not depend on the
latest raw user sentence or prompt-only instructions. Clicking a UI option can replace the latest
message with a short label, while the actual evidence requirement may live in earlier user intent.
The same research retrieval code is also used by Next route handlers and standalone Bun workers, so
the shared research service must not depend on Next-only module sentinels.

## Decision

Use a shared research evidence boundary:

- `research/evidence-request.ts` resolves a structured `ResearchEvidenceRequest` from recent user
  intent. It scores recent messages by evidence strength, so a short UI option clicked after a
  detailed freshness request cannot overwrite the original research requirement.
- `research/web-research.ts` remains the provider retrieval service and is runtime-neutral.
- `interview/web-research-context.ts` is an adapter that turns a structured request plus retrieval
  output into an interview prompt block.
- The interview agent uses AI SDK v6 `prepareStep` to force `presentOutlinePreview` when code has
  already determined that evidence-backed drafting is required.

## Consequences

The frontend no longer needs to infer research behavior from text, and the model no longer decides
whether current evidence is required from prompt wording alone. Future chat, interview, and
background research flows can reuse the same evidence request resolver and provider retrieval
service.

The tradeoff is that the evidence policy becomes product code and must be maintained as the product
learns new domains. That is intentional: temporal and evidence requirements are business behavior,
not prompt decoration.
