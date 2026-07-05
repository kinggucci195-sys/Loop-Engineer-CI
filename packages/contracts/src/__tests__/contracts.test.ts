import {
  ciFailureEventSchema,
  classificationSchema,
  engineeringMemoryEventSchema,
  engineeringMemoryRecordSchema,
  engineeringRecognitionSummarySchema,
  evidenceBundleSchema,
  failureFingerprintSchema,
  fingerprintSchema,
  repairPlanSchema
} from "../index";

describe("LoopCI contracts", () => {
  it("validates a CI failure event", () => {
    const event = ciFailureEventSchema.parse({
      provider: "github-actions",
      repository: "kinggucci195-sys/loopci",
      workflow: "ci",
      runId: "1001",
      runUrl: "https://github.com/kinggucci195-sys/loopci/actions/runs/1001",
      commitSha: "abcdef1",
      branch: "main",
      failedJob: "test",
      failedStep: "npm test",
      logExcerpt: "Expected status 200 but received 500"
    });

    expect(event.provider).toBe("github-actions");
  });

  it("rejects confidence outside the valid range", () => {
    expect(() =>
      classificationSchema.parse({
        kind: "unit-test",
        risk: "medium",
        confidence: 2,
        summary: "Bad confidence",
        likelyFiles: [],
        recommendedChecks: [],
        requiresHuman: true,
        rationale: "Confidence must be bounded."
      })
    ).toThrow();
  });

  it("validates a repair plan with evidence requirements", () => {
    const now = new Date().toISOString();
    const event = {
      provider: "github-actions" as const,
      repository: "kinggucci195-sys/loopci",
      workflow: "ci",
      runId: "1001",
      runUrl: "https://github.com/kinggucci195-sys/loopci/actions/runs/1001",
      commitSha: "abcdef1",
      branch: "main",
      failedJob: "test",
      failedStep: "npm test",
      logExcerpt: "Expected status 200 but received 500"
    };

    const plan = repairPlanSchema.parse({
      id: "plan-1",
      event,
      classification: {
        kind: "unit-test",
        risk: "medium",
        confidence: 0.8,
        summary: "Unit test failed.",
        likelyFiles: ["src/example.ts"],
        recommendedChecks: ["npm test"],
        requiresHuman: true,
        rationale: "Test failure touches runtime behavior."
      },
      status: "queued",
      branchName: "loopci/fix-unit-test",
      goal: "Make npm test pass without weakening assertions.",
      steps: ["Reproduce the failing test."],
      evidenceRequired: ["npm test output"],
      residualRisk: "Weak test coverage could miss semantic regressions.",
      createdAt: now
    });

    expect(plan.evidenceRequired).toContain("npm test output");
  });

  it("validates an evidence bundle", () => {
    const bundle = evidenceBundleSchema.parse({
      planId: "plan-1",
      repository: "kinggucci195-sys/loopci",
      branchName: "loopci/fix-lint",
      summary: "Lint repair evidence.",
      commandsToRun: ["npm run lint"],
      requiredHumanChecks: ["Review diff."],
      riskNotes: ["Low risk."],
      createdAt: new Date().toISOString()
    });

    expect(bundle.commandsToRun).toContain("npm run lint");
  });

  it("validates fingerprints and failure fingerprints", () => {
    const fingerprint = fingerprintSchema.parse({
      id: "fp-123",
      type: "ci-failure",
      version: 1,
      signature: "repo|ci|test|npm test|unit-test|expected 200"
    });

    const failureFingerprint = failureFingerprintSchema.parse({
      ...fingerprint,
      repository: "kinggucci195-sys/loopci",
      workflow: "ci",
      job: "validate",
      step: "npm test",
      kind: "unit-test",
      normalizedSignature: "expected 200",
      likelyFiles: ["src/example.ts"]
    });

    expect(failureFingerprint.type).toBe("ci-failure");
  });

  it("validates memory events and requires the event version", () => {
    const event = {
      version: 1,
      id: "memevt-1",
      type: "failure-observed",
      memoryId: "memory-fp-123",
      fingerprintId: "fp-123",
      fingerprintType: "ci-failure",
      fingerprintVersion: 1,
      fingerprint: {
        id: "fp-123",
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
          likelyFiles: ["src/example.ts"]
        }
      },
      correlationId: "ci-run:github-actions:kinggucci195-sys/loopci:ci:1001",
      actor: "gerald",
      planId: "plan-1",
      occurredAt: new Date().toISOString(),
      relationships: {
        repository: "kinggucci195-sys/loopci",
        workflow: "ci",
        pullRequest: null,
        ticket: null,
        files: ["src/example.ts"],
        repairPlanIds: ["plan-1"]
      },
      outcome: "unknown"
    };

    expect(engineeringMemoryEventSchema.parse(event).version).toBe(1);
    expect(() =>
      engineeringMemoryEventSchema.parse({ ...event, version: undefined })
    ).toThrow();
    expect(() =>
      engineeringMemoryEventSchema.parse({ ...event, type: "made-up-event" })
    ).toThrow();
    expect(() =>
      engineeringMemoryEventSchema.parse({ ...event, outcome: "maybe-fixed" })
    ).toThrow();
  });

  it("validates memory projections and requires the schema version", () => {
    const record = {
      schemaVersion: 1,
      id: "memory-fp-123",
      recordType: "ci-failure",
      fingerprintId: "fp-123",
      fingerprintType: "ci-failure",
      fingerprintVersion: 1,
      lifecycleState: "active",
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      relationships: {
        repository: "kinggucci195-sys/loopci",
        workflow: "ci",
        deployment: null,
        incident: null,
        files: ["src/example.ts"],
        repairPlanIds: ["plan-1"]
      },
      outcomes: ["unknown"],
      occurrenceCount: 1,
      previousRepairCount: 0
    };

    expect(engineeringMemoryRecordSchema.parse(record).schemaVersion).toBe(1);
    expect(() =>
      engineeringMemoryRecordSchema.parse({
        ...record,
        schemaVersion: undefined
      })
    ).toThrow();
  });

  it("validates recognition summaries and rejects invalid confidence", () => {
    const summary = {
      seenBefore: true,
      recurring: false,
      recognitionType: "exact-fingerprint",
      occurrenceCount: 2,
      previousRepairCount: 1,
      lastSuccessfulRepairPlanId: "plan-1",
      likelyPriorFixer: "gerald",
      confidence: 0.91,
      confidenceReasoning: ["Seen 2 times", "Previous repair succeeded"]
    };

    expect(engineeringRecognitionSummarySchema.parse(summary).confidence).toBe(
      0.91
    );
    expect(() =>
      engineeringRecognitionSummarySchema.parse({
        ...summary,
        confidence: 1.5
      })
    ).toThrow();
  });
});
