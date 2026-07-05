import type { EngineeringMemoryEvent } from "@loopci/contracts";
import { rebuildMemoryProjections, replayMemoryProjections } from "../replay";
import { createJsonlMemoryStore } from "../memory-store";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function event(
  id: string,
  occurredAt: string,
  planId: string,
  repository = "kinggucci195-sys/loopci",
  fingerprintId = "fp-1"
): EngineeringMemoryEvent {
  return {
    version: 1,
    id,
    type: "failure-observed",
    idempotencyKey: `failure-observed:${repository}:${fingerprintId}:${planId}`,
    source: "test",
    sourceEventId: id,
    memoryId: `memory-${fingerprintId}`,
    fingerprintId,
    fingerprintType: "ci-failure",
    fingerprintVersion: 1,
    fingerprint: {
      id: fingerprintId,
      type: "ci-failure",
      version: 1,
      signature: "repo|ci|validate|npm test|unit-test|expected 200",
      source: {
        repository,
        workflow: "ci",
        job: "validate",
        step: "npm test",
        kind: "unit-test",
        normalizedSignature: "expected 200",
        likelyFiles: ["src/index.ts"]
      }
    },
    correlationId: "ci-run:github-actions:kinggucci195-sys/loopci:ci:1001",
    actor: "gerald",
    planId,
    occurredAt,
    relationships: {
      repository,
      workflow: "ci",
      owner: "gerald",
      files: ["src/index.ts"],
      repairPlanIds: [planId]
    },
    outcome: "unknown",
    metadata: {}
  };
}

describe("memory replay", () => {
  it("rebuilds projections from immutable events", () => {
    const records = rebuildMemoryProjections([
      event("event-2", "2026-07-06T00:00:00.000Z", "plan-2"),
      event("event-1", "2026-07-05T00:00:00.000Z", "plan-1")
    ]);

    expect(records).toEqual([
      expect.objectContaining({
        id: "memory-fp-1",
        fingerprintVersion: 1,
        occurrenceCount: 2,
        firstSeenAt: "2026-07-05T00:00:00.000Z",
        lastSeenAt: "2026-07-06T00:00:00.000Z",
        firstObservedAt: "2026-07-05T00:00:00.000Z",
        lastObservedAt: "2026-07-06T00:00:00.000Z",
        lastUpdatedAt: "2026-07-06T00:00:00.000Z"
      })
    ]);
  });

  it("can rebuild a partition by repository", () => {
    const records = rebuildMemoryProjections(
      [
        event(
          "event-1",
          "2026-07-05T00:00:00.000Z",
          "plan-1",
          "kinggucci195-sys/loopci",
          "fp-1"
        ),
        event(
          "event-2",
          "2026-07-05T00:00:00.000Z",
          "plan-2",
          "kinggucci195-sys/other",
          "fp-2"
        )
      ],
      {
        repository: "kinggucci195-sys/loopci"
      }
    );

    expect(records).toEqual([
      expect.objectContaining({
        fingerprintId: "fp-1",
        relationships: expect.objectContaining({
          repository: "kinggucci195-sys/loopci"
        })
      })
    ]);
  });

  it("rebuilds complete fingerprint history for repository partitions", () => {
    const records = rebuildMemoryProjections(
      [
        event(
          "event-1",
          "2026-07-05T00:00:00.000Z",
          "plan-1",
          "kinggucci195-sys/loopci",
          "fp-1"
        ),
        event(
          "event-2",
          "2026-07-06T00:00:00.000Z",
          "plan-2",
          "kinggucci195-sys/loopci",
          "fp-1"
        )
      ],
      {
        occurredAtFrom: "2026-07-06T00:00:00.000Z",
        repository: "kinggucci195-sys/loopci"
      }
    );

    expect(records).toEqual([
      expect.objectContaining({
        fingerprintId: "fp-1",
        occurrenceCount: 2
      })
    ]);
  });

  it("replaces stored projections from the event log", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-memory-replay-"));
    const store = createJsonlMemoryStore({
      eventsPath: join(dir, "memory-events.jsonl"),
      recordsPath: join(dir, "memory.jsonl")
    });

    await store.appendEvent(
      event("event-1", "2026-07-05T00:00:00.000Z", "plan-1")
    );
    await store.appendEvent(
      event("event-2", "2026-07-06T00:00:00.000Z", "plan-2")
    );

    const records = await replayMemoryProjections(store);

    expect(records).toHaveLength(1);
    expect(await store.listRecords()).toEqual(records);
    expect(await store.listEvents()).toHaveLength(2);
  });

  it("does not persist date-range analysis as canonical projections", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-memory-replay-"));
    const store = createJsonlMemoryStore({
      eventsPath: join(dir, "memory-events.jsonl"),
      recordsPath: join(dir, "memory.jsonl")
    });

    await store.appendEvent(
      event("event-1", "2026-07-05T00:00:00.000Z", "plan-1")
    );
    await store.appendEvent(
      event("event-2", "2026-07-06T00:00:00.000Z", "plan-2")
    );
    const canonicalRecords = await replayMemoryProjections(store);
    const analysisRecords = await replayMemoryProjections(store, {
      occurredAtFrom: "2026-07-06T00:00:00.000Z"
    });

    expect(analysisRecords).toEqual([
      expect.objectContaining({
        occurrenceCount: 1
      })
    ]);
    expect(await store.listRecords()).toEqual(canonicalRecords);
  });
});
