import {
  ciFailureEventSchema,
  classificationSchema,
  evidenceBundleSchema,
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
});
