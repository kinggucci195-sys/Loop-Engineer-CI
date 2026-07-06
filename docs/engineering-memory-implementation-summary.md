# LoopCI Engineering Memory Engine Implementation Summary

This document summarizes what was implemented after the OpenAI architecture review/roast and why it matters.

## Product Context

LoopCI is still publicly positioned as:

> Failed build response for engineering teams.

The deeper architecture is becoming:

> An engineering memory layer that remembers how a team breaks, fixes, reviews, deploys, and recovers software over time.

The goal was not to turn LoopCI into generic "AI magic." The goal was to harden the foundation so future intelligence comes from durable organizational memory, not from guessing.

## What The OpenAI Review Pushed Us Toward

The review said the earlier architecture was improving, but the remaining gaps were production architecture concerns:

- retries could create duplicate memory events
- partial replay could corrupt projections
- repair actions needed to become real business events
- timestamps were too ambiguous
- event migration policy was not explicit
- architecture invariants needed tests, not just normal unit tests
- confidence and recognition should stay separated
- memory should stay advisory, not automation authority

The implementation focused on those points instead of UI or unnecessary product expansion.

## Implemented Changes

### 1. Event Idempotency

Problem:

GitHub webhooks, Slack callbacks, workers, and network calls can retry. Without idempotency, LoopCI could record duplicate memory events and falsely increase recurrence counts.

Implemented:

- Added `idempotencyKey` to every `EngineeringMemoryEvent`.
- Added `source` to identify where the event came from.
- Added optional `sourceEventId` to link to the upstream provider event.
- `MemoryStore.appendEvent()` now rejects duplicate event ids and duplicate idempotency keys.

Why it matters:

This keeps memory trustworthy. If GitHub sends the same failed workflow event twice, LoopCI does not think the failure happened twice.

### 2. Deterministic Memory Event IDs

Problem:

Memory event ids were tied too closely to plan ids and were not designed around retry safety.

Implemented:

- Failure-observed event ids are now derived from a stable idempotency key.
- The id is generated from a SHA-256 hash of the idempotency key.

Example idempotency inputs:

```text
failure-observed
provider
repository
workflow
run id
commit sha
failed job
failed step
fingerprint id
```

Why it matters:

The same upstream failure produces the same memory identity. Retry behavior becomes predictable.

### 3. Safe Replay Semantics

Problem:

Partial replay is dangerous in event-sourced systems. If a date-range replay rebuilds projections from incomplete history, it can overwrite canonical projections with wrong occurrence counts.

Implemented:

- Full replay rebuilds every projection.
- Fingerprint replay rebuilds the complete history for that fingerprint.
- Repository replay rebuilds complete histories for fingerprints in that repository.
- Date-only replay is analysis-only and does not overwrite canonical projections.

Why it matters:

This prevents projection corruption. A replay command should never silently erase historical context.

### 4. Repair Requested Event

Problem:

When a user asks LoopCI to fix something, that is a real business event. It should be part of memory, not only a transient status change.

Implemented:

- Added `createRepairRequestedEvent()`.
- When `/actions/plans/:planId/request-fix` is accepted, LoopCI now appends a `repair-requested` memory event.
- The projection is rebuilt from the updated event history.

Why it matters:

Later, LoopCI can answer questions like:

- How often do users request fixes for this failure?
- Which recommendations get acted on?
- Which requested fixes eventually succeed?

### 5. Clearer Projection Timestamps

Problem:

`lastSeenAt` became ambiguous. Did it mean last failure observed, last repair requested, last outcome update, or last memory update?

Implemented:

- Added `firstObservedAt`.
- Added `lastObservedAt`.
- Added `lastUpdatedAt`.
- Recognition confidence now uses `lastObservedAt` instead of ambiguous `lastSeenAt`.

Why it matters:

Recognition should reason about recurrence of failures, not accidentally treat a repair request as a new failure observation.

### 6. Projection Rebuild From Events

Problem:

The architecture says immutable events are the source of truth and projections are rebuildable caches. The implementation needed to enforce that more strongly.

Implemented:

- Accepted CI failures now append a memory event, then reload events by fingerprint, then rebuild the projection from the complete event list.
- Duplicate appends do not inflate projection counts because projections are derived from stored events.

Why it matters:

The projection is no longer treated like primary truth. It is a cache derived from the event log.

### 7. Architecture Invariant Tests

Problem:

Normal unit tests are not enough for event-sourced architecture. Some properties must remain true forever.

Implemented tests for:

- deleting/rebuilding projections from events recreates the same projection
- `ProjectionBuilder` does not mutate input events
- `RecognitionEngine` does not import filesystem modules
- `ConfidenceEngine` is deterministic

Why it matters:

These tests protect architectural boundaries, not just individual functions.

### 8. Memory Store Duplicate Tests

Implemented tests proving:

- missing memory files return empty events/projections
- appending an event writes to the immutable log
- duplicate idempotency keys are rejected
- projection writes do not mutate the event log
- reads by memory id and fingerprint id work

Why it matters:

This directly addresses retry and storage reliability concerns.

### 9. Replay Tests

Implemented tests proving:

- full replay rebuilds projections
- repository/fingerprint partition replay uses complete histories
- date-only replay is analysis-only
- analysis-only replay does not overwrite canonical projections

Why it matters:

Replay is now safer and closer to real event-sourcing discipline.

### 10. Server Integration Tests

Implemented tests proving:

- accepted failures write memory events and projections when memory is enabled
- duplicate accepted CI failure posts do not duplicate memory events
- accepted failure responses include recognition summaries
- `repair-requested` is appended when fix is requested
- memory endpoints continue to work

Why it matters:

This proves the architecture is wired into the actual product flow, not just isolated modules.

### 11. Documentation Updates

Updated:

- `README.md`
- `docs/engineering-memory.md`

Added:

- `docs/architecture-decisions/ADR-001-event-source-of-truth.md`

The ADR explains:

- immutable events are the source of truth
- projections are rebuildable caches
- JSONL is acceptable for v1
- exact fingerprint matching only in v1
- no similarity or graph system yet
- memory remains advisory
- old events are immutable forever
- replay never rewrites events
- migrations append new facts instead of editing old history

Why it matters:

Future contributors can understand why the architecture works this way instead of second-guessing it later.

## Files Changed

Core contracts:

- `packages/contracts/src/index.ts`
- `packages/contracts/src/__tests__/contracts.test.ts`

Memory engine:

- `services/orchestrator/src/memory/memory-store.ts`
- `services/orchestrator/src/memory/projection-builder.ts`
- `services/orchestrator/src/memory/replay.ts`
- `services/orchestrator/src/memory/recognition-engine.ts`
- `services/orchestrator/src/memory/__tests__/memory-store.test.ts`
- `services/orchestrator/src/memory/__tests__/projection-builder.test.ts`
- `services/orchestrator/src/memory/__tests__/recognition-engine.test.ts`
- `services/orchestrator/src/memory/__tests__/replay.test.ts`
- `services/orchestrator/src/memory/__tests__/architecture-invariants.test.ts`

Server/orchestrator:

- `services/orchestrator/src/server.ts`
- `services/orchestrator/src/__tests__/server.test.ts`
- `services/orchestrator/src/cli/memory-replay.ts`

Docs:

- `README.md`
- `docs/engineering-memory.md`
- `docs/architecture-decisions/ADR-001-event-source-of-truth.md`

## Validation

Local checks passed:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Test result:

```text
27 test suites passed
86 tests passed
```

GitHub Actions passed:

- CI run: `28744522844`
- Commit: `9d379e2 Harden engineering memory events and replay`
- Validate job passed
- Docker Build job passed

## What This Means Architecturally

LoopCI now has a stronger event-sourced foundation:

```text
CI Failure
↓
Failure Fingerprint
↓
Immutable Memory Event
↓
Projection Builder
↓
Engineering Memory Record
↓
Recognition Engine
↓
Confidence Engine
↓
Repair Plan / Repair Request
```

The most important principle:

```text
EngineeringMemoryEvent = source of truth
EngineeringMemoryRecord = rebuildable projection/cache
Recognition = derived analysis
Confidence = derived score
Policy/human approval = authority
```

Memory does not override policy.

Memory does not auto-merge.

Memory does not claim automation authority.

Memory provides evidence.

## What Was Intentionally Not Implemented

These were discussed but postponed:

- fuzzy similarity
- embeddings
- generic engineering graph
- pluggable recognition providers
- full Engineering Case domain object
- Postgres/EventStoreDB/Kafka migration
- autonomous merge or deploy authority
- separate recognition/ownership/repair/evidence confidence values

Why:

Those may be correct later, but v1 needs trustworthy exact memory first. Adding a graph or similarity system before the event model is durable would create complexity without enough product signal.

## Remaining Product Architecture Questions

These are the next big design questions from the latest OpenAI feedback.

### 1. What is the identity of a repair plan?

Current `RepairPlan` still mixes several concepts:

- generated recommendation
- user-requestable plan
- possible fix workflow
- future execution attempt
- future outcome

Long term, these may become separate domain objects:

```text
CI Failure
↓
Memory Record
↓
Repair Recommendation
↓
Repair Request
↓
Repair Attempt
↓
Repair Outcome
```

Recommendation:

Do not fully split this yet. Document the boundary now. Split it when LoopCI actually executes repairs and records outcomes.

### 2. Where does policy live?

Today policy is mostly tied to CI failure handling.

Future event sources may include:

- CI
- PRs
- deployments
- incidents
- manual reports
- flaky test reports

Question:

Should one PolicyEngine handle every event type, or should each producer/source have domain-specific policy?

Recommendation:

Keep current policy for CI. Introduce a generic policy boundary only when the second event source exists.

### 3. Can Memory exist without CI?

Strategic answer:

Yes, eventually.

CI is one producer. Memory should become the platform.

Future producers could include:

- deployment events
- incident events
- pull request events
- code review events
- flaky test events
- ownership changes

Recommendation:

Keep the public wedge as failed build response, but keep the internal memory model generic enough to accept other producers later.

### 4. Should Recognition become pluggable?

Today:

```text
RecognitionEngine = exact fingerprint recognition
```

Future:

```text
ExactRecognition
TemporalRecognition
OwnershipRecognition
RegressionRecognition
FlakyTestRecognition
DeploymentRecognition
```

Recommendation:

Do not implement `RecognitionProvider[]` yet. Add it when the second recognition strategy exists.

### 5. Is confidence actually one number?

Current confidence is best understood as:

```text
recognitionConfidence
```

Future confidence dimensions may include:

- recognition confidence
- ownership confidence
- repair confidence
- evidence confidence

Recommendation:

Rename or document current confidence as recognition confidence before adding more confidence types.

### 6. How are event schema migrations handled?

Events are versioned, but there is no full upcaster/deserializer layer yet.

Future model:

```text
Raw persisted event
↓
Deserializer
↓
Upcaster
↓
Current domain event
```

Recommendation:

Add this before introducing event version 2.

### 7. Is there a missing domain object?

Likely yes.

Future object:

```text
EngineeringCase
```

It could link:

- failure
- memory
- repair recommendation
- repair request
- evidence
- approval
- PR
- deployment
- outcome
- comments

Recommendation:

Do not build it today. Leave room for it. It may become the future user-facing timeline.

## What The Moat Should Be

LoopCI's moat should not be:

- GitHub integration
- Slack integration
- AI-generated repair plans
- CI classification
- memory records by themselves

Those are features.

The stronger moat is:

> LoopCI remembers how your engineering organization behaves.

Over time, LoopCI can learn:

- which repositories fail together
- which workflows are flaky
- which engineers usually fix specific failure types
- which reviewers catch regressions
- which teams introduce breaking changes
- which branches regress often
- which fixes usually work
- which fixes usually fail
- which services break after certain deployments

That becomes proprietary organizational memory.

## Current Status

The hardening work is complete and merged to `main`.

Current commit:

```text
9d379e2 Harden engineering memory events and replay
```

GitHub CI passed.

The repository is clean.

## Recommended Next Steps

Short term:

1. Keep testing against real CI failures.
2. Add more real outcome events only when the product can observe them.
3. Clarify `RepairPlan` domain language in docs.
4. Document current confidence as recognition confidence.
5. Add event deserialization/upcasting before introducing event version 2.

Do not add yet:

- embeddings
- generic graph database
- similarity search
- autonomous repair execution
- large new abstractions without a second concrete use case

Best next product move:

Use the memory engine on real failures and measure whether engineers find these answers valuable:

- Have we seen this before?
- What worked last time?
- Who fixed it?
- Did the requested fix actually work?

If those answers become useful repeatedly, LoopCI has a real foundation for engineering intelligence later.
