export interface EngineeringRecognitionConfidenceInput {
  occurrenceCount: number;
  lastSeenAt: string;
  successfulRepairCount: number;
  failedOutcomeCount: number;
}

export interface EngineeringRecognitionConfidence {
  confidence: number;
  confidenceReasoning: string[];
}

export function scoreEngineeringRecognitionConfidence(
  input: EngineeringRecognitionConfidenceInput
): EngineeringRecognitionConfidence {
  let confidence = 0.25;
  const confidenceReasoning: string[] = [];

  if (input.occurrenceCount > 1) {
    confidence += 0.2;
    confidenceReasoning.push(`Seen ${input.occurrenceCount} times`);
  } else {
    confidenceReasoning.push("First observed occurrence");
  }

  if (input.occurrenceCount >= 3) {
    confidence += 0.15;
    confidenceReasoning.push("Recurring exact fingerprint");
  }

  if (input.successfulRepairCount > 0) {
    confidence += 0.2;
    confidenceReasoning.push("Previous repair succeeded");
  }

  if (isRecent(input.lastSeenAt)) {
    confidence += 0.1;
    confidenceReasoning.push("Recent occurrence");
  } else {
    confidenceReasoning.push("Last occurrence is not recent");
  }

  if (input.failedOutcomeCount > 0) {
    confidence -= 0.2;
    confidenceReasoning.push("Failed repair or regression exists");
  }

  return {
    confidence: Math.max(0, Math.min(1, Number(confidence.toFixed(2)))),
    confidenceReasoning
  };
}

function isRecent(isoDate: string): boolean {
  const ageMs = Date.now() - Date.parse(isoDate);
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return Number.isFinite(ageMs) && ageMs <= thirtyDaysMs;
}
