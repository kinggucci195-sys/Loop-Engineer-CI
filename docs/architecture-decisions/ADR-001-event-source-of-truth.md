# ADR-001: Engineering Memory Uses Immutable Events As Source Of Truth

## Status

Accepted.

## Context

LoopCI needs to answer whether a CI failure has been seen before, what happened last time, and who handled it. The system should remain advisory and focused on failed build response while leaving room for richer engineering memory later.

## Decision

Engineering Memory stores immutable events as the source of truth and treats projections as rebuildable caches.

LoopCI v1 will:

- append memory events with idempotency keys
- keep `memory-events.jsonl` as durable history
- keep `memory.jsonl` as rebuildable projection state
- compute recognition dynamically from projections and events
- keep confidence scoring separate from recognition facts
- use exact fingerprint matching only
- keep memory advisory; policy and human approval remain authoritative

## Rationale

Event sourcing gives LoopCI a reliable recovery path: if projections are wrong or deleted, replay can rebuild them from facts. This follows the same broad principle used by EventStoreDB, Axon-style CQRS systems, Kafka consumers, Git's immutable object model, and Kubernetes reconciliation loops: durable facts first, derived state second.

JSONL is intentionally used for v1 because the product is still proving value. Replacing it with Postgres, Kafka, or EventStoreDB now would increase operational complexity before LoopCI has enough real CI failure volume to justify it.

Similarity and embeddings are postponed because v1 should make exact recurrence trustworthy before claiming semantic intelligence.

## Migration Policy

- Old events are immutable forever.
- Replay never rewrites events.
- Projection schemas may evolve.
- Fingerprint algorithms are versioned.
- New migrations append new facts or create new projections instead of editing history.
- Partial date-range replay is analysis-only unless paired with a stable partition such as fingerprint id or repository.

## Consequences

Benefits:

- Projections can be rebuilt after corruption or storage migration.
- Duplicate webhook retries can be rejected by idempotency key.
- Recognition can improve without rewriting historical events.
- Future storage backends can replace JSONL behind `MemoryStore`.

Tradeoffs:

- Event schemas must be treated carefully because old events live forever.
- Projection bugs require replay, not direct mutation.
- Outcome claims are limited until LoopCI emits real repair and deployment lifecycle events.

## Non-Goals

- No fuzzy similarity in v1.
- No generic engineering knowledge graph in v1.
- No production database migration in v1.
- No autonomous merge or deploy authority.
