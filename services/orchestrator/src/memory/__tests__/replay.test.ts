import type { EngineeringMemoryEvent } from "@loopci/contracts";
import { rebuildMemoryProjections, replayMemoryProjections } from "../replay";
import { createJsonlMemoryStore } from "../memory-store";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function event(
  id: string,
  occurredAt: string,
  planId: string
): EngineeringMemoryEvent {
  return {
    version: 1,
    id,
    type: "failure-observed",
    memoryId: "memory-fp-1",
    fingerprintId: "fp-1",
    fingerprintType: "ci-failure",
    fingerprintVersion: 1,
    correlationId: "ci-run:github-actions:kinggucci195-sys/loopci:ci:1001",
    actor: "gerald",
    planId,
    occurredAt,
    relationships: {
      repository: "kinggucci195-sys/loopci",
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
        lastSeenAt: "2026-07-06T00:00:00.000Z"
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
});
