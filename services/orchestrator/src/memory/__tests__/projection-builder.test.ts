import type {
  CiFailureEvent,
  FailureClassification,
  EngineeringMemoryEvent,
  FailureFingerprint
} from "@loopci/contracts";
import {
  createFailureObservedEvent,
  createMemoryId,
  rebuildProjectionFromEvents,
  updateProjectionWithEvent
} from "../projection-builder";
import { createRepairPlan } from "../../domain/repair-plan";

const fingerprint: FailureFingerprint = {
  id: "fp-unit",
  type: "ci-failure",
  version: 1,
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
    fingerprintVersion: fingerprint.version,
    fingerprint: {
      id: fingerprint.id,
      type: fingerprint.type,
      version: fingerprint.version,
      signature: fingerprint.signature,
      source: {
        repository: fingerprint.repository,
        workflow: fingerprint.workflow,
        job: fingerprint.job,
        step: fingerprint.step,
        kind: fingerprint.kind,
        normalizedSignature: fingerprint.normalizedSignature,
        likelyFiles: fingerprint.likelyFiles
      }
    },
    correlationId: "ci-run:github-actions:kinggucci195-sys/loopci:ci:1001",
    actor: "gerald",
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
  it("stores canonical fingerprint fields on observed failure events", () => {
    const eventInput: CiFailureEvent = {
      provider: "github-actions",
      repository: fingerprint.repository,
      workflow: fingerprint.workflow,
      runId: "1001",
      runUrl: "https://github.com/kinggucci195-sys/loopci/actions/runs/1001",
      commitSha: "abcdef1",
      branch: "main",
      triggeringActor: "gerald",
      failedJob: fingerprint.job,
      failedStep: fingerprint.step,
      logExcerpt: "Expected status 200"
    };
    const classification: FailureClassification = {
      kind: fingerprint.kind,
      risk: "medium",
      confidence: 0.72,
      summary: "Unit test failed.",
      likelyFiles: fingerprint.likelyFiles,
      recommendedChecks: ["npm test"],
      requiresHuman: true,
      rationale: "Detected assertion failure."
    };

    const observedEvent = createFailureObservedEvent(
      createRepairPlan(eventInput, classification),
      fingerprint,
      {
        owner: "gerald",
        source: "triggering-actor"
      },
      "2026-07-05T00:00:00.000Z"
    );

    expect(observedEvent).toMatchObject({
      actor: "gerald",
      fingerprint: {
        id: fingerprint.id,
        type: "ci-failure",
        version: 1,
        source: {
          repository: fingerprint.repository,
          workflow: fingerprint.workflow,
          job: fingerprint.job,
          step: fingerprint.step,
          kind: fingerprint.kind,
          normalizedSignature: fingerprint.normalizedSignature,
          likelyFiles: fingerprint.likelyFiles
        }
      },
      metadata: {
        ownershipSource: "triggering-actor"
      }
    });
  });

  it("creates a projection from the first failure-observed event", () => {
    const projection = rebuildProjectionFromEvents(fingerprint, [
      event("event-1", "failure-observed", "2026-07-05T00:00:00.000Z")
    ]);

    expect(projection).toMatchObject({
      id: createMemoryId(fingerprint.id),
      fingerprintVersion: 1,
      lifecycleState: "active",
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
