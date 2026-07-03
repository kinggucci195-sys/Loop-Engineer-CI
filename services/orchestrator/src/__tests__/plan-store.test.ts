import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJsonlPlanStore } from "../state/plan-store";
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
  failedStep: "npm run typecheck",
  logExcerpt: "Type error in src/index.ts"
};

const classification: FailureClassification = {
  kind: "typecheck",
  risk: "medium",
  confidence: 0.8,
  summary: "Typecheck failed.",
  likelyFiles: ["src/index.ts"],
  recommendedChecks: ["npm run typecheck"],
  requiresHuman: true,
  rationale: "TypeScript signature matched."
};

describe("createJsonlPlanStore", () => {
  it("returns an empty list when the state file does not exist", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const store = createJsonlPlanStore(join(dir, "missing", "plans.jsonl"));

    await expect(store.list()).resolves.toEqual([]);
  });

  it("appends and reads repair plans", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const store = createJsonlPlanStore(join(dir, "plans.jsonl"));
    const plan = createRepairPlan(event, classification);

    await store.append(plan);
    const plans = await store.list();

    expect(plans).toHaveLength(1);
    expect(plans[0]?.classification.kind).toBe("typecheck");
  });
});
