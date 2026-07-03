import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RepairPlan } from "@loopci/contracts";
import { createWorkerPlanStore } from "../plan-reader";

function createPlan(status: RepairPlan["status"]): RepairPlan {
  return {
    id: `plan-${status}`,
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
    status,
    branchName: "loopci/lint-validate-1001",
    goal: "Make lint pass.",
    steps: ["Run lint."],
    evidenceRequired: ["Exact failed command output after the fix"],
    residualRisk: "Human review is still required.",
    createdAt: new Date().toISOString()
  };
}

describe("createWorkerPlanStore", () => {
  it("returns empty plans for a missing file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const store = createWorkerPlanStore(join(dir, "missing.jsonl"));

    await expect(store.list()).resolves.toEqual([]);
  });

  it("returns null when no queued plan is available", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const filePath = join(dir, "plans.jsonl");
    await writeFile(filePath, `${JSON.stringify(createPlan("blocked"))}\n`, "utf8");
    const store = createWorkerPlanStore(filePath);

    await expect(store.claimNext()).resolves.toBeNull();
  });

  it("throws when updating a missing plan", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const filePath = join(dir, "plans.jsonl");
    await writeFile(filePath, `${JSON.stringify(createPlan("blocked"))}\n`, "utf8");
    const store = createWorkerPlanStore(filePath);

    await expect(store.update(createPlan("queued"))).rejects.toThrow(
      "Repair plan not found"
    );
  });
});
