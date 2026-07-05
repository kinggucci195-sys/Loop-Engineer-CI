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
-> ConfidenceEngine
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

- `idempotencyKey`
- `source`
- optional `sourceEventId`
- canonical `fingerprint`
- `fingerprintVersion`
- `correlationId`
- optional `causationId`
- optional `actor`

The top-level fingerprint id/type/version are retained for indexing. The `fingerprint` snapshot preserves the canonical source fields used to derive the id, so replay and future migrations do not depend on reconstructing old normalization inputs from unrelated payloads.

`MemoryStore` rejects duplicate event ids and duplicate idempotency keys. GitHub, Slack, worker, or network retries should not inflate occurrence counts.

### ProjectionBuilder

`ProjectionBuilder` owns projection derivation. It turns ordered memory events into an `EngineeringMemoryRecord` with:

- `firstSeenAt`
- `lastSeenAt`
- occurrence count
- recent repair plan ids
- relationships
- outcome summary
- last successful repair plan id
- lifecycle state

The projection can be rebuilt later if JSONL storage is replaced by a database.

LoopCI includes a replay command for recovery and migration:

```bash
npm run build --workspace @loopci/orchestrator
npm run memory:replay --workspace @loopci/orchestrator
```

Replay reads `memory-events.jsonl`, rebuilds projections, and replaces `memory.jsonl`.

Replay can also target partitions:

```bash
npm run memory:replay --workspace @loopci/orchestrator -- --repository=owner/repo
npm run memory:replay --workspace @loopci/orchestrator -- --fingerprint-id=fp-id
npm run memory:replay --workspace @loopci/orchestrator -- --from=2026-07-01T00:00:00.000Z --to=2026-07-31T23:59:59.999Z
```

Partitioned replay updates matching projections without replacing unrelated records.

Date-range replay is analysis-only unless it is paired with a stable partition such as repository or fingerprint id. A partial event stream must not overwrite canonical projections.

### Lifecycle

`EngineeringMemoryRecord` has a lifecycle state:

- `active`
- `archived`
- `superseded`

v1 creates active records. Archived repositories, renamed repositories, deleted workflows, and future fingerprint migrations should move records out of the active set instead of deleting history.

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

Old events remain on their original fingerprint version. A future migration can write new facts or mark old projections `superseded`, but replay must never silently recalculate old fingerprint ids with a newer algorithm.

Migration policy:

- old events are immutable forever
- projections may change as projection schemas evolve
- replay never rewrites events
- migrations append new facts instead of editing history
- old fingerprint versions remain recognizable

Future fingerprint types can represent deployments, incidents, pull requests, reviews, rollbacks, or approvals without changing the memory engine contract.

### Ownership

Ownership is resolved through an `OwnershipResolver` interface. v1 uses a fallback resolver:

1. triggering actor
2. actor
3. commit author email
4. unknown

Future resolvers can add CODEOWNERS, git blame, team ownership, service catalogs, or manual overrides without changing memory events or projection logic.

### RecognitionEngine

`RecognitionEngine` is a pure function:

```text
recognize(projection, recentEvents) -> recognitionSummary
```

It performs no file IO and knows nothing about JSONL storage. That keeps recognition easy to test and safe to reuse from the API, notifications, or future repair planning.

v1 recognition uses `recognitionType: exact-fingerprint`.

### ConfidenceEngine

Confidence is separated from recognition facts. `RecognitionEngine` derives facts such as seen-before, occurrence count, last successful repair, and likely prior fixer. `ConfidenceEngine` scores how much LoopCI should trust those facts for the current response.

Confidence is derived, not invented. The score considers:

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
