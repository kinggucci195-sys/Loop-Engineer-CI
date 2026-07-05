import type {
  EngineeringMemoryEvent,
  EngineeringMemoryOutcome,
  EngineeringMemoryRecord,
  EngineeringMemoryRelationships,
  FailureFingerprint,
  RepairPlan
} from "@loopci/contracts";

const RECENT_REPAIR_PLAN_LIMIT = 10;

export function createFailureObservedEvent(
  plan: RepairPlan,
  fingerprint: FailureFingerprint,
  occurredAt = new Date().toISOString()
): EngineeringMemoryEvent {
  const owner =
    plan.event.triggeringActor ??
    plan.event.actor ??
    plan.event.commitAuthorEmail ??
    undefined;

  return {
    version: 1,
    id: `memevt-${plan.id}-failure-observed`,
    type: "failure-observed",
    memoryId: createMemoryId(fingerprint.id),
    fingerprintId: fingerprint.id,
    fingerprintType: fingerprint.type,
    planId: plan.id,
    occurredAt,
    relationships: {
      repository: plan.event.repository,
      workflow: plan.event.workflow,
      commitSha: plan.event.commitSha,
      owner,
      files: fingerprint.likelyFiles,
      repairPlanIds: [plan.id]
    },
    outcome: "unknown",
    metadata: {
      failedJob: plan.event.failedJob,
      failedStep: plan.event.failedStep,
      kind: plan.classification.kind,
      risk: plan.classification.risk
    }
  };
}

export function createRecognitionGeneratedEvent(
  plan: RepairPlan,
  fingerprint: FailureFingerprint,
  confidence: number,
  occurredAt = new Date().toISOString()
): EngineeringMemoryEvent {
  return {
    version: 1,
    id: `memevt-${plan.id}-recognition-generated`,
    type: "recognition-generated",
    memoryId: createMemoryId(fingerprint.id),
    fingerprintId: fingerprint.id,
    fingerprintType: fingerprint.type,
    planId: plan.id,
    occurredAt,
    relationships: {
      repository: plan.event.repository,
      workflow: plan.event.workflow,
      commitSha: plan.event.commitSha,
      owner: plan.event.triggeringActor ?? plan.event.actor,
      files: fingerprint.likelyFiles,
      repairPlanIds: [plan.id]
    },
    metadata: {
      confidence
    }
  };
}

export function createMemoryId(fingerprintId: string): string {
  return `memory-${fingerprintId}`;
}

export function rebuildProjectionFromEvents(
  fingerprint: FailureFingerprint,
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
    firstSeenAt: firstEvent.occurredAt,
    lastSeenAt: lastEvent.occurredAt,
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

export function updateProjectionWithEvent(
  fingerprint: FailureFingerprint,
  existingEvents: EngineeringMemoryEvent[],
  event: EngineeringMemoryEvent
): EngineeringMemoryRecord {
  return rebuildProjectionFromEvents(fingerprint, [...existingEvents, event]);
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
