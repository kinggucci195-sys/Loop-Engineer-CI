import type { RepairPlan } from "@loopci/contracts";

export function createNotificationTestPlan(
  overrides: Partial<RepairPlan["event"]> = {}
): RepairPlan {
  return {
    id: "plan-1",
    ownership: {
      owner: "platform-team",
      source: "codeowners"
    },
    event: {
      provider: "github-actions",
      repository: "kinggucci195-sys/loopci",
      workflow: "ci",
      runId: "1001",
      runUrl: "https://github.com/kinggucci195-sys/loopci/actions/runs/1001",
      commitSha: "abcdef1",
      branch: "main",
      actor: "kinggucci195-sys",
      failedJob: "validate",
      failedStep: "npm run typecheck",
      logExcerpt: "TypeScript error",
      ...overrides
    },
    classification: {
      kind: "typecheck",
      risk: "low",
      confidence: 0.9,
      summary: "TypeScript failed.",
      likelyFiles: ["src/example.ts"],
      recommendedChecks: ["npm run typecheck"],
      requiresHuman: false,
      rationale: "Compiler output points at one file."
    },
    status: "queued",
    branchName: "loopci/fix-typecheck",
    goal: "Make TypeScript checks pass.",
    steps: ["Reproduce the compiler error."],
    evidenceRequired: ["npm run typecheck output"],
    residualRisk: "Confirm public API types still match callers.",
    createdAt: new Date().toISOString()
  };
}
