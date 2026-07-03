import { buildEvidenceBundle } from "../evidence/evidence-bundle";
import type { RepairPlan } from "@loopci/contracts";

describe("buildEvidenceBundle", () => {
  it("creates human review evidence for a repair plan", () => {
    const plan: RepairPlan = {
      id: "plan-1",
      event: {
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
      },
      classification: {
        kind: "lint",
        risk: "low",
        confidence: 0.72,
        summary: "Lint failure.",
        likelyFiles: ["src/index.ts"],
        recommendedChecks: ["npm run lint"],
        requiresHuman: false,
        rationale: "ESLint signature matched."
      },
      status: "queued",
      branchName: "loopci/lint-validate-1001",
      goal: "Make lint pass.",
      steps: ["Run lint."],
      evidenceRequired: ["Exact failed command output after the fix"],
      residualRisk: "Human review is still required.",
      createdAt: new Date().toISOString()
    };

    const bundle = buildEvidenceBundle(plan);

    expect(bundle.commandsToRun).toContain("npm run lint");
    expect(bundle.requiredHumanChecks).toContain(
      "Approve merge only after required checks pass."
    );
  });
});
