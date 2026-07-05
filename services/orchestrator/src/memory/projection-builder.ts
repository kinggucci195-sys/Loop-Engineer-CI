import { createHash } from "node:crypto";
import type {
  EngineeringMemoryEvent,
  EngineeringMemoryOutcome,
  EngineeringMemoryRecord,
  EngineeringMemoryRelationships,
  Fingerprint,
  FailureFingerprint,
  RepairPlan
} from "@loopci/contracts";
import type { OwnershipResolution } from "../ownership/ownership-resolver";

const RECENT_REPAIR_PLAN_LIMIT = 10;

export function createFailureObservedEvent(
  plan: RepairPlan,
  fingerprint: FailureFingerprint,
  ownership: OwnershipResolution,
  occurredAt = new Date().toISOString()
): EngineeringMemoryEvent {
  const idempotencyKey = [
    "failure-observed",
    plan.event.provider,
    plan.event.repository,
    plan.event.workflow,
    plan.event.runId,
    plan.event.commitSha,
    plan.event.failedJob,
    plan.event.failedStep,
    fingerprint.id
  ].join(":");

  return {
    version: 1,
    id: createMemoryEventId(idempotencyKey),
    type: "failure-observed",
    idempotencyKey,
    source: plan.event.provider,
    sourceEventId: plan.event.runId,
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
    correlationId: createCiRunCorrelationId(plan),
    actor: ownership.owner,
    planId: plan.id,
    occurredAt,
    relationships: {
      repository: plan.event.repository,
      workflow: plan.event.workflow,
      commitSha: plan.event.commitSha,
      owner: ownership.owner,
      files: fingerprint.likelyFiles,
      repairPlanIds: [plan.id]
    },
    outcome: "unknown",
    metadata: {
      failedJob: plan.event.failedJob,
      failedStep: plan.event.failedStep,
      fingerprintSignature: fingerprint.signature,
      fingerprintNormalizedSignature: fingerprint.normalizedSignature,
      kind: plan.classification.kind,
      ownershipSource: ownership.source,
      risk: plan.classification.risk
    }
  };
}

export function createRepairRequestedEvent(
  plan: RepairPlan,
  sourceEvent: EngineeringMemoryEvent,
  occurredAt = new Date().toISOString()
): EngineeringMemoryEvent {
  const idempotencyKey = ["repair-requested", plan.id].join(":");
  const actor =
    plan.event.triggeringActor ??
    plan.event.actor ??
    plan.event.commitAuthorEmail ??
    undefined;

  return {
    version: 1,
    id: createMemoryEventId(idempotencyKey),
    type: "repair-requested",
    idempotencyKey,
    source: "loopci-action",
    sourceEventId: plan.id,
    memoryId: sourceEvent.memoryId,
    fingerprintId: sourceEvent.fingerprintId,
    fingerprintType: sourceEvent.fingerprintType,
    fingerprintVersion: sourceEvent.fingerprintVersion,
    fingerprint: sourceEvent.fingerprint,
    correlationId: sourceEvent.correlationId,
    causationId: sourceEvent.id,
    actor,
    planId: plan.id,
    occurredAt,
    relationships: {
      ...sourceEvent.relationships,
      repairPlanIds: [plan.id]
    },
    outcome: "fix-requested",
    metadata: {
      requestedStatus: plan.status
    }
  };
}

export function createMemoryId(fingerprintId: string): string {
  return `memory-${fingerprintId}`;
}

export function rebuildProjectionFromEvents(
  fingerprint: Pick<Fingerprint, "id" | "type" | "version">,
  events: EngineeringMemoryEvent[]
): EngineeringMemoryRecord {
  const sortedEvents = [...events].sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt)
  );
  const firstEvent = sortedEvents[0];
  const lastEvent = sortedEvents[sortedEvents.length - 1];

  if (!firstEvent || !lastEvent) {
    throw new Error(`Cannot build memory projection without events.`);
  }

  const occurrenceCount = sortedEvents.filter(
    (event) => event.type === "failure-observed"
  ).length;
  const observedEvents = sortedEvents.filter(
    (event) => event.type === "failure-observed"
  );
  const outcomes = sortedEvents
    .map((event) => event.outcome)
    .filter((outcome): outcome is EngineeringMemoryOutcome => Boolean(outcome));
  const relationships = mergeRelationships(sortedEvents);
  const lastSuccessfulRepairPlanId = [...sortedEvents]
    .reverse()
    .find((event) => event.type === "repair-succeeded")?.planId;

  return {
    schemaVersion: 1,
    id: createMemoryId(fingerprint.id),
    recordType: "ci-failure",
    fingerprintId: fingerprint.id,
    fingerprintType: fingerprint.type,
    fingerprintVersion: fingerprint.version,
    lifecycleState: "active",
    firstSeenAt: firstEvent.occurredAt,
    lastSeenAt: lastEvent.occurredAt,
    firstObservedAt: observedEvents[0]?.occurredAt ?? firstEvent.occurredAt,
    lastObservedAt:
      observedEvents[observedEvents.length - 1]?.occurredAt ??
      lastEvent.occurredAt,
    lastUpdatedAt: lastEvent.occurredAt,
    relationships,
    outcomes,
    occurrenceCount,
    previousRepairCount: sortedEvents.filter((event) =>
      ["repair-requested", "repair-succeeded", "repair-failed"].includes(
        event.type
      )
    ).length,
    lastSuccessfulRepairPlanId
  };
}

function createMemoryEventId(idempotencyKey: string): string {
  return `memevt-${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 24)}`;
}

export function updateProjectionWithEvent(
  fingerprint: Pick<Fingerprint, "id" | "type" | "version">,
  existingEvents: EngineeringMemoryEvent[],
  event: EngineeringMemoryEvent
): EngineeringMemoryRecord {
  return rebuildProjectionFromEvents(fingerprint, [...existingEvents, event]);
}

export function createCiRunCorrelationId(plan: RepairPlan): string {
  return [
    "ci-run",
    plan.event.provider,
    plan.event.repository,
    plan.event.workflow,
    plan.event.runId
  ].join(":");
}

function mergeRelationships(
  events: EngineeringMemoryEvent[]
): EngineeringMemoryRelationships {
  const files = new Set<string>();
  const repairPlanIds: string[] = [];
  const merged: EngineeringMemoryRelationships = {
    files: [],
    repairPlanIds: []
  };

  for (const event of events) {
    const relationships = event.relationships;
    merged.repository = relationships.repository ?? merged.repository;
    merged.workflow = relationships.workflow ?? merged.workflow;
    merged.commitSha = relationships.commitSha ?? merged.commitSha;
    merged.pullRequest = relationships.pullRequest ?? merged.pullRequest;
    merged.ticket = relationships.ticket ?? merged.ticket;
    merged.deployment = relationships.deployment ?? merged.deployment;
    merged.incident = relationships.incident ?? merged.incident;
    merged.owner = relationships.owner ?? merged.owner;

    for (const file of relationships.files) {
      files.add(file);
    }

    for (const planId of relationships.repairPlanIds) {
      if (!repairPlanIds.includes(planId)) {
        repairPlanIds.push(planId);
      }
    }
  }

  return {
    ...merged,
    files: [...files],
    repairPlanIds: repairPlanIds.slice(-RECENT_REPAIR_PLAN_LIMIT)
  };
}
