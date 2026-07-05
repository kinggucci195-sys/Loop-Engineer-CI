# Engineering Memory Engine

Engineering Memory Engine v1 is LoopCI's first durable memory layer. The public product remains failed build response: a failed GitHub Actions run becomes an owned repair plan with evidence, risk, routing, and human approval.

Memory adds three answers to that loop:

- Have we seen this failure before?
- What worked last time?
- Who fixed it?

## Architecture

```text
CI Event
-> MemoryStore
-> ProjectionBuilder
-> EngineeringMemoryRecord
-> RecognitionEngine
-> RepairPlanner
-> Notification Layer
```

### MemoryStore

`MemoryStore` is deliberately boring. It appends immutable `EngineeringMemoryEvent` records to JSONL and reads/writes projection records. It does not derive counts, calculate confidence, or decide whether a failure was seen before.

The source files are derived from `STATE_DIR`:

- `memory-events.jsonl`
- `memory.jsonl`

The interface is storage-agnostic. `JsonlMemoryStore` is the v1 implementation; future implementations can use SQLite, Postgres, object storage, or another durable backend without changing recognition logic.

### Events Are Source Of Truth

`EngineeringMemoryEvent` is append-only and versioned with `version: 1`.

v1 event types:

- `failure-observed`
- `repair-requested`
- `repair-succeeded`
- `repair-failed`
- `regression-detected`

Projection fields such as occurrence count are caches. If a count disagrees with the event log, the event log wins.

Recognition is not stored as an event because it is derived analysis. If the recognition algorithm changes, LoopCI should recompute recognition from facts instead of preserving stale analysis.

Each event includes:

- `fingerprintVersion`
- `correlationId`
- optional `causationId`
- optional `actor`

### ProjectionBuilder

`ProjectionBuilder` owns projection derivation. It turns ordered memory events into an `EngineeringMemoryRecord` with:

- `firstSeenAt`
- `lastSeenAt`
- occurrence count
- recent repair plan ids
- relationships
- outcome summary
- last successful repair plan id

The projection can be rebuilt later if JSONL storage is replaced by a database.

LoopCI includes a replay command for recovery and migration:

```bash
npm run build --workspace @loopci/orchestrator
npm run memory:replay --workspace @loopci/orchestrator
```

Replay reads `memory-events.jsonl`, rebuilds projections, and replaces `memory.jsonl`.

### Fingerprints

The memory engine compares generic `Fingerprint` objects. v1 implements `FailureFingerprint` for CI failures.

A failure fingerprint uses deterministic exact matching from:

- repository
- workflow
- failed job
- failed step
- failure kind
- normalized log signature
- likely files

Normalization removes noisy timestamps, URLs, SHAs, run ids, and unstable line or column values where safe.

Fingerprints are versioned with `version: 1`. Future normalization changes can introduce a new fingerprint version without corrupting historical recognition.

Future fingerprint types can represent deployments, incidents, pull requests, reviews, rollbacks, or approvals without changing the memory engine contract.

### RecognitionEngine

`RecognitionEngine` is a pure function:

```text
recognize(projection, recentEvents) -> recognitionSummary
```

It performs no file IO and knows nothing about JSONL storage. That keeps recognition easy to test and safe to reuse from the API, notifications, or future repair planning.

v1 recognition uses `recognitionType: exact-fingerprint`.

## Confidence

Recognition confidence is derived, not invented. The score considers:

- exact repeated occurrences
- whether the failure is recurring
- whether prior repairs succeeded
- whether the occurrence is recent
- whether failed repairs or regressions exist

Every summary includes `confidenceReasoning` so engineers can see why LoopCI trusts or distrusts the recognition.

## Why No Similarity Yet

v1 intentionally avoids fuzzy similarity, embeddings, and semantic matching. Exact fingerprint recognition solves the first valuable problem without creating unexplained "similar failure" claims.

Similarity can come later when LoopCI can explain why two failures are related.

## Advisory Only

Engineering memory is evidence, not automation authority. Policy, risk, deterministic checks, and human review still decide whether repair work can proceed.

## Future Graph Direction

This architecture is intentionally event-first. As LoopCI observes more engineering activity, the same memory model can grow toward an engineering graph:

- repositories
- services
- owners
- pull requests
- reviews
- deployments
- incidents
- rollbacks
- repair outcomes

The long-term value is not a chatbot guessing from logs. It is LoopCI remembering how a specific engineering organization breaks, fixes, reviews, and ships software.
