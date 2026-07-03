import { createRepairPlan } from "../domain/repair-plan";
import type { CiFailureEvent, FailureClassification } from "@loopci/contracts";

const event: CiFailureEvent = {
  provider: "github-actions",
  repository: "kinggucci195-sys/loopci",
  workflow: "ci",
  runId: "1001",
  runUrl: "https://github.com/kinggucci195-sys/loopci/actions/runs/1001",
  commitSha: "abcdef1",
  branch: "main",
  failedJob: "validate",
  failedStep: "npm run lint",
  logExcerpt: "ESLint no-console violation"
};

function classification(kind: FailureClassification["kind"]): FailureClassification {
  return {
    kind,
    risk: kind === "lint" ? "low" : "medium",
    confidence: 0.8,
    summary: `${kind} failed.`,
    likelyFiles: [],
    recommendedChecks: ["npm run lint"],
    requiresHuman: kind !== "lint",
    rationale: "Test classification."
  };
}

describe("createRepairPlan", () => {
  it("queues low-risk lint failures", () => {
    const plan = createRepairPlan(event, classification("lint"));

    expect(plan.status).toBe("queued");
    expect(plan.goal).toContain("lint checks pass");
  });

  it("blocks flaky failures for human policy review", () => {
    const plan = createRepairPlan(event, classification("flaky-or-noisy"));

    expect(plan.status).toBe("blocked");
    expect(plan.goal).toContain("flaky");
  });
});
