import { buildServer } from "../server";
import { createJsonlPlanStore } from "../state/plan-store";
import { createHeuristicClassifier } from "../ai/classifier";
import { loadEnv } from "@loopci/config";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("orchestrator server", () => {
  it("creates a repair plan from a failed GitHub Actions event", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const server = buildServer({
      env: loadEnv({ NODE_ENV: "test" }),
      classifier: createHeuristicClassifier(),
      planStore: createJsonlPlanStore(join(dir, "plans.jsonl"))
    });

    const response = await server.inject({
      method: "POST",
      url: "/events/github-actions/failure",
      payload: {
        provider: "github-actions",
        repository: "kinggucci195-sys/loopci",
        workflow: "ci",
        runId: "1001",
        runUrl: "https://github.com/kinggucci195-sys/loopci/actions/runs/1001",
        commitSha: "abcdef1",
        branch: "main",
        failedJob: "validate",
        failedStep: "npm run lint",
        logExcerpt: "ESLint no-console violation in src/index.ts"
      }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().plan.classification.kind).toBe("lint");
  });
});
