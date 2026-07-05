import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { EngineeringMemoryEvent } from "@loopci/contracts";
import { createJsonlMemoryStore } from "../memory-store";
import { rebuildMemoryProjections, replayMemoryProjections } from "../replay";
import { scoreEngineeringRecognitionConfidence } from "../confidence-engine";

function event(id: string, occurredAt: string): EngineeringMemoryEvent {
  return {
    version: 1,
    id,
    type: "failure-observed",
    idempotencyKey: `failure-observed:${id}`,
    source: "test",
    sourceEventId: id,
    memoryId: "memory-fp-1",
    fingerprintId: "fp-1",
    fingerprintType: "ci-failure",
    fingerprintVersion: 1,
    fingerprint: {
      id: "fp-1",
      type: "ci-failure",
      version: 1,
      signature: "repo|ci|validate|npm test|unit-test|expected 200",
      source: {
        repository: "kinggucci195-sys/loopci",
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
    planId: id,
    occurredAt,
    relationships: {
      repository: "kinggucci195-sys/loopci",
      workflow: "ci",
      files: ["src/index.ts"],
      repairPlanIds: [id]
    },
    outcome: "unknown",
    metadata: {}
  };
}

describe("memory architecture invariants", () => {
  it("replay from events recreates the same projection after projection loss", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-memory-invariant-"));
    const store = createJsonlMemoryStore({
      eventsPath: join(dir, "memory-events.jsonl"),
      recordsPath: join(dir, "memory.jsonl")
    });

    await store.appendEvent(event("plan-1", "2026-07-05T00:00:00.000Z"));
    await store.appendEvent(event("plan-2", "2026-07-06T00:00:00.000Z"));

    const rebuiltFromMemory = rebuildMemoryProjections(
      await store.listEvents()
    );
    const replayed = await replayMemoryProjections(store);

    expect(replayed).toEqual(rebuiltFromMemory);
  });

  it("ProjectionBuilder never mutates input events", () => {
    const events = [
      event("plan-1", "2026-07-05T00:00:00.000Z"),
      event("plan-2", "2026-07-06T00:00:00.000Z")
    ];
    const snapshot = structuredClone(events);

    rebuildMemoryProjections(events);

    expect(events).toEqual(snapshot);
  });

  it("RecognitionEngine does not import filesystem modules", async () => {
    const source = await readFile(
      resolve(__dirname, "../recognition-engine.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/node:fs|fs\/promises|from "fs"/);
  });

  it("ConfidenceEngine is deterministic for identical inputs", () => {
    const input = {
      occurrenceCount: 3,
      lastSeenAt: "2026-07-05T00:00:00.000Z",
      successfulRepairCount: 1,
      failedOutcomeCount: 0
    };

    expect(scoreEngineeringRecognitionConfidence(input)).toEqual(
      scoreEngineeringRecognitionConfidence(input)
    );
  });
});
