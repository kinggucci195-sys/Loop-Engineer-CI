import type {
  EngineeringMemoryEvent,
  EngineeringMemoryRecord,
  EngineeringRecognitionSummary
} from "@loopci/contracts";

export function recognizeEngineeringMemory(
  record: EngineeringMemoryRecord,
  events: EngineeringMemoryEvent[]
): EngineeringRecognitionSummary {
  const failureEvents = events.filter(
    (event) => event.type === "failure-observed"
  );
  const repairSucceededEvents = events.filter(
    (event) => event.type === "repair-succeeded"
  );
  const failedOutcomeCount = events.filter((event) =>
    ["repair-failed", "regression-detected"].includes(event.type)
  ).length;
  const occurrenceCount = failureEvents.length;
  const seenBefore = occurrenceCount > 1;
  const recurring = occurrenceCount >= 3;
  const lastSuccessfulRepairPlanId =
    repairSucceededEvents[repairSucceededEvents.length - 1]?.planId ??
    record.lastSuccessfulRepairPlanId;
  const confidenceParts = deriveConfidence({
    occurrenceCount,
    lastSeenAt: record.lastSeenAt,
    successfulRepairCount: repairSucceededEvents.length,
    failedOutcomeCount
  });

  return {
    seenBefore,
    recurring,
    recognitionType: "exact-fingerprint",
    occurrenceCount,
    previousRepairCount: record.previousRepairCount,
    lastSuccessfulRepairPlanId,
    likelyPriorFixer: record.relationships.owner ?? undefined,
    confidence: confidenceParts.confidence,
    confidenceReasoning: confidenceParts.reasoning
  };
}

function deriveConfidence(input: {
  occurrenceCount: number;
  lastSeenAt: string;
  successfulRepairCount: number;
  failedOutcomeCount: number;
}): { confidence: number; reasoning: string[] } {
  let confidence = 0.25;
  const reasoning: string[] = [];

  if (input.occurrenceCount > 1) {
    confidence += 0.2;
    reasoning.push(`Seen ${input.occurrenceCount} times`);
  } else {
    reasoning.push("First observed occurrence");
  }

  if (input.occurrenceCount >= 3) {
    confidence += 0.15;
    reasoning.push("Recurring exact fingerprint");
  }

  if (input.successfulRepairCount > 0) {
    confidence += 0.2;
    reasoning.push("Previous repair succeeded");
  }

  if (isRecent(input.lastSeenAt)) {
    confidence += 0.1;
    reasoning.push("Recent occurrence");
  } else {
    reasoning.push("Last occurrence is not recent");
  }

  if (input.failedOutcomeCount > 0) {
    confidence -= 0.2;
    reasoning.push("Failed repair or regression exists");
  }

  return {
    confidence: Math.max(0, Math.min(1, Number(confidence.toFixed(2)))),
    reasoning
  };
}

function isRecent(isoDate: string): boolean {
  const ageMs = Date.now() - Date.parse(isoDate);
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return Number.isFinite(ageMs) && ageMs <= thirtyDaysMs;
}
