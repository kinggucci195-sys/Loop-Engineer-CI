import type {
  EngineeringMemoryEvent,
  EngineeringMemoryRecord,
  EngineeringRecognitionSummary
} from "@loopci/contracts";
import { scoreEngineeringRecognitionConfidence } from "./confidence-engine";

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
  const confidence = scoreEngineeringRecognitionConfidence({
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
    confidence: confidence.confidence,
    confidenceReasoning: confidence.confidenceReasoning
  };
}
