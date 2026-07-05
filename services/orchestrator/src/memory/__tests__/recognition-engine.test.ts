import type {
  EngineeringMemoryEvent,
  EngineeringMemoryRecord
} from "@loopci/contracts";
import { recognizeEngineeringMemory } from "../recognition-engine";

const record: EngineeringMemoryRecord = {
  schemaVersion: 1,
  id: "memory-fp-1",
  recordType: "ci-failure",
  fingerprintId: "fp-1",
  fingerprintType: "ci-failure",
  fingerprintVersion: 1,
  firstSeenAt: new Date().toISOString(),
  lastSeenAt: new Date().toISOString(),
  relationships: {
    owner: "gerald",
    files: ["src/index.ts"],
    repairPlanIds: ["plan-1"]
  },
  outcomes: ["unknown"],
  occurrenceCount: 1,
  previousRepairCount: 0
};

function event(
  id: string,
  type: EngineeringMemoryEvent["type"],
  planId: string
): EngineeringMemoryEvent {
  return {
    version: 1,
    id,
    type,
    memoryId: record.id,
    fingerprintId: record.fingerprintId,
    fingerprintType: record.fingerprintType,
    fingerprintVersion: record.fingerprintVersion,
    correlationId: "ci-run:github-actions:kinggucci195-sys/loopci:ci:1001",
    actor: "gerald",
    planId,
    occurredAt: new Date().toISOString(),
    relationships: {
      owner: "gerald",
      files: ["src/index.ts"],
      repairPlanIds: [planId]
    },
    outcome:
      type === "repair-succeeded"
        ? "verified-fix"
        : type === "repair-failed"
          ? "failed-repair"
          : "unknown",
    metadata: {}
  };
}

describe("recognizeEngineeringMemory", () => {
  it("returns first occurrence recognition without storage dependencies", () => {
    const summary = recognizeEngineeringMemory(record, [
      event("event-1", "failure-observed", "plan-1")
    ]);

    expect(summary).toMatchObject({
      seenBefore: false,
      recurring: false,
      recognitionType: "exact-fingerprint",
      occurrenceCount: 1
    });
  });

  it("marks the second occurrence as seen before", () => {
    const summary = recognizeEngineeringMemory(record, [
      event("event-1", "failure-observed", "plan-1"),
      event("event-2", "failure-observed", "plan-2")
    ]);

    expect(summary.seenBefore).toBe(true);
    expect(summary.recurring).toBe(false);
  });

  it("marks the third occurrence as recurring", () => {
    const summary = recognizeEngineeringMemory(record, [
      event("event-1", "failure-observed", "plan-1"),
      event("event-2", "failure-observed", "plan-2"),
      event("event-3", "failure-observed", "plan-3")
    ]);

    expect(summary.recurring).toBe(true);
  });

  it("uses prior successful repairs and prior fixers in recognition", () => {
    const summary = recognizeEngineeringMemory(
      {
        ...record,
        previousRepairCount: 1
      },
      [
        event("event-1", "failure-observed", "plan-1"),
        event("event-2", "repair-succeeded", "plan-1")
      ]
    );

    expect(summary.lastSuccessfulRepairPlanId).toBe("plan-1");
    expect(summary.likelyPriorFixer).toBe("gerald");
    expect(summary.confidenceReasoning).toContain("Previous repair succeeded");
  });

  it("lowers confidence when failed repairs or regressions exist", () => {
    const positive = recognizeEngineeringMemory(record, [
      event("event-1", "failure-observed", "plan-1")
    ]);
    const negative = recognizeEngineeringMemory(record, [
      event("event-1", "failure-observed", "plan-1"),
      event("event-2", "repair-failed", "plan-1"),
      event("event-3", "regression-detected", "plan-1")
    ]);

    expect(negative.confidence).toBeLessThan(positive.confidence);
    expect(negative.confidenceReasoning).toContain(
      "Failed repair or regression exists"
    );
  });
});
