import { createHeuristicClassifier } from "../ai/classifier";
import type { CiFailureEvent } from "@loopci/contracts";

const baseEvent: CiFailureEvent = {
  provider: "github-actions",
  repository: "kinggucci195-sys/loopci",
  workflow: "ci",
  runId: "1001",
  runUrl: "https://github.com/kinggucci195-sys/loopci/actions/runs/1001",
  commitSha: "abcdef1",
  branch: "main",
  failedJob: "validate",
  failedStep: "npm run lint",
  logExcerpt: "ESLint no-console violation in services/orchestrator/src/index.ts"
};

describe("heuristic failure classifier", () => {
  it("classifies lint failures as low risk", async () => {
    const classifier = createHeuristicClassifier();
    const classification = await classifier.classify(baseEvent);

    expect(classification.kind).toBe("lint");
    expect(classification.risk).toBe("low");
    expect(classification.requiresHuman).toBe(false);
  });

  it("extracts likely files from logs", async () => {
    const classifier = createHeuristicClassifier();
    const classification = await classifier.classify(baseEvent);

    expect(classification.likelyFiles).toContain(
      "services/orchestrator/src/index.ts"
    );
  });
});
