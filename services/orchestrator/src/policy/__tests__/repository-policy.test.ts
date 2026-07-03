import type { CiFailureEvent, FailureClassification } from "@loopci/contracts";
import {
  applyLogLimit,
  createDefaultRepositoryPolicy,
  enforceRepositoryPolicy,
  isBranchAllowed
} from "../repository-policy";

const event: CiFailureEvent = {
  provider: "github-actions",
  repository: "kinggucci195-sys/loopci",
  workflow: "ci",
  runId: "1001",
  runUrl: "https://github.com/kinggucci195-sys/loopci/actions/runs/1001",
  commitSha: "abcdef1",
  branch: "main",
  failedJob: "test",
  failedStep: "npm test",
  logExcerpt: "test failed"
};

const classification: FailureClassification = {
  kind: "lint",
  risk: "low",
  confidence: 0.9,
  summary: "Lint failed",
  likelyFiles: [],
  recommendedChecks: ["npm run lint"],
  requiresHuman: false,
  rationale: "ESLint output"
};

describe("repository policy", () => {
  it("allows exact branches and prefix wildcards", () => {
    const policy = {
      ...createDefaultRepositoryPolicy("kinggucci195-sys/loopci"),
      allowedBranches: ["main", "release/*"]
    };

    expect(isBranchAllowed(policy, "main")).toBe(true);
    expect(isBranchAllowed(policy, "release/2026-07")).toBe(true);
    expect(isBranchAllowed(policy, "feature/x")).toBe(false);
  });

  it("forces human review for kinds outside the low-risk policy", () => {
    const policy = {
      ...createDefaultRepositoryPolicy("kinggucci195-sys/loopci"),
      lowRiskKinds: ["format" as const]
    };

    const result = enforceRepositoryPolicy(event, classification, policy);

    expect(result.requiresHuman).toBe(true);
  });

  it("truncates excerpts to the configured policy limit", () => {
    const policy = {
      ...createDefaultRepositoryPolicy("kinggucci195-sys/loopci"),
      maxLogExcerptChars: 80
    };
    const result = applyLogLimit(
      {
        ...event,
        logExcerpt: "x".repeat(200)
      },
      policy
    );

    expect(result.logExcerpt.length).toBeLessThanOrEqual(80);
    expect(result.logExcerpt).toContain("LoopCI truncated");
  });
});
