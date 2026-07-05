import { scoreEngineeringRecognitionConfidence } from "../confidence-engine";

describe("scoreEngineeringRecognitionConfidence", () => {
  it("scores derived confidence with positive and negative reasoning", () => {
    const score = scoreEngineeringRecognitionConfidence({
      occurrenceCount: 3,
      lastSeenAt: new Date().toISOString(),
      successfulRepairCount: 1,
      failedOutcomeCount: 1
    });

    expect(score.confidence).toBeGreaterThan(0);
    expect(score.confidenceReasoning).toEqual(
      expect.arrayContaining([
        "Seen 3 times",
        "Recurring exact fingerprint",
        "Previous repair succeeded",
        "Recent occurrence",
        "Failed repair or regression exists"
      ])
    );
  });
});
