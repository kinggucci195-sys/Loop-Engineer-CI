import type {
  EngineeringMemoryEvent,
  FailureFingerprint
} from "@loopci/contracts";
import {
  createMemoryId,
  rebuildProjectionFromEvents,
  updateProjectionWithEvent
} from "../projection-builder";

const fingerprint: FailureFingerprint = {
  id: "fp-unit",
  type: "ci-failure",
  signature: "repo|ci|validate|npm test|unit-test|expected 200",
  repository: "kinggucci195-sys/loopci",
  workflow: "ci",
  job: "validate",
  step: "npm test",
  kind: "unit-test",
  normalizedSignature: "expected 200",
  likelyFiles: ["src/index.ts"]
};

function event(
  id: string,
  type: EngineeringMemoryEvent["type"],
  occurredAt: string,
  planId = "plan-1"
): EngineeringMemoryEvent {
  return {
    version: 1,
    id,
    type,
    memoryId: createMemoryId(fingerprint.id),
    fingerprintId: fingerprint.id,
    fingerprintType: fingerprint.type,
    planId,
    occurredAt,
    relationships: {
      repository: fingerprint.repository,
      workflow: fingerprint.workflow,
      owner: "gerald",
      files: fingerprint.likelyFiles,
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

describe("ProjectionBuilder", () => {
  it("creates a projection from the first failure-observed event", () => {
    const projection = rebuildProjectionFromEvents(fingerprint, [
      event("event-1", "failure-observed", "2026-07-05T00:00:00.000Z")
    ]);

    expect(projection).toMatchObject({
      id: createMemoryId(fingerprint.id),
      occurrenceCount: 1,
      firstSeenAt: "2026-07-05T00:00:00.000Z",
      lastSeenAt: "2026-07-05T00:00:00.000Z"
    });
  });

  it("derives occurrence count from repeated failure events", () => {
    const first = event(
      "event-1",
      "failure-observed",
      "2026-07-05T00:00:00.000Z"
    );
    const second = event(
      "event-2",
      "failure-observed",
      "2026-07-06T00:00:00.000Z",
      "plan-2"
    );

    const projection = updateProjectionWithEvent(fingerprint, [first], second);

    expect(projection.occurrenceCount).toBe(2);
    expect(projection.relationships.repairPlanIds).toEqual([
      "plan-1",
      "plan-2"
    ]);
    expect(projection.lastSeenAt).toBe("2026-07-06T00:00:00.000Z");
  });

  it("updates outcome projections without rewriting event history", () => {
    const events = [
      event("event-1", "failure-observed", "2026-07-05T00:00:00.000Z"),
      event("event-2", "repair-succeeded", "2026-07-05T00:05:00.000Z", "plan-1")
    ];

    const projection = rebuildProjectionFromEvents(fingerprint, events);

    expect(projection.occurrenceCount).toBe(1);
    expect(projection.previousRepairCount).toBe(1);
    expect(projection.lastSuccessfulRepairPlanId).toBe("plan-1");
    expect(events).toHaveLength(2);
  });

  it("rebuilds the same projection from an event list", () => {
    const events = [
      event("event-1", "failure-observed", "2026-07-05T00:00:00.000Z"),
      event("event-2", "failure-observed", "2026-07-06T00:00:00.000Z", "plan-2")
    ];

    expect(rebuildProjectionFromEvents(fingerprint, events)).toEqual(
      rebuildProjectionFromEvents(fingerprint, [...events].reverse())
    );
  });
});
