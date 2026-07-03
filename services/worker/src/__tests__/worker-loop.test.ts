import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RepairPlan } from "@loopci/contracts";
import { createJsonEvidenceStore } from "../state/evidence-store";
import { createWorkerPlanStore } from "../plan-reader";
import { runWorkerLoop } from "../worker-loop";
import type { Logger } from "@loopci/logger";

function createSilentLogger(): Logger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

function createPlan(): RepairPlan {
  return {
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
}

describe("runWorkerLoop", () => {
  it("claims a queued plan and persists an evidence bundle", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const planPath = join(dir, "plans.jsonl");
    const planStore = createWorkerPlanStore(planPath);
    const evidenceStore = createJsonEvidenceStore(join(dir, "evidence"));
    const plan = createPlan();

    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(planPath, `${JSON.stringify(plan)}\n`, "utf8")
    );

    await runWorkerLoop({
      planStore,
      evidenceStore,
      logger: createSilentLogger(),
      pollIntervalMs: 1,
      runOnce: true
    });

    const updatedPlans = await planStore.list();
    const evidence = JSON.parse(
      await readFile(join(dir, "evidence", "plan-1.json"), "utf8")
    );

    expect(updatedPlans[0]?.status).toBe("evidence-attached");
    expect(evidence.commandsToRun).toContain("npm run lint");
  });

  it("returns immediately in run-once mode when no queued plans exist", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const planStore = createWorkerPlanStore(join(dir, "missing.jsonl"));
    const evidenceStore = createJsonEvidenceStore(join(dir, "evidence"));
    const logger = createSilentLogger();

    await runWorkerLoop({
      planStore,
      evidenceStore,
      logger,
      pollIntervalMs: 1,
      runOnce: true
    });

    expect(logger.debug).toHaveBeenCalledWith(
      {},
      "No queued repair plans found"
    );
  });
});
