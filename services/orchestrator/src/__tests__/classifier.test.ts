import {
  createFailureClassifier,
  createHeuristicClassifier
} from "../ai/classifier";
import type { CiFailureEvent } from "@loopci/contracts";
import { loadEnv } from "@loopci/config";

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
  logExcerpt:
    "ESLint no-console violation in services/orchestrator/src/index.ts"
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

  it("classifies unknown failures conservatively", async () => {
    const classifier = createHeuristicClassifier();
    const classification = await classifier.classify({
      ...baseEvent,
      failedStep: "custom command",
      logExcerpt: "The build did something surprising."
    });

    expect(classification.kind).toBe("unknown");
    expect(classification.risk).toBe("medium");
    expect(classification.requiresHuman).toBe(true);
  });

  it.each([
    [
      "flaky-or-noisy",
      "npm test",
      "Test timed out after 5000 ms and passed on retry."
    ],
    [
      "dependency",
      "npm ci",
      "npm ERR! ERESOLVE unable to resolve dependency tree"
    ],
    [
      "environment",
      "setup node",
      "Missing env DATABASE_URL in CI environment"
    ],
    [
      "integration-test",
      "integration test",
      "Postgres database connection ECONNREFUSED during integration test"
    ],
    ["e2e-test", "playwright test", "Playwright browser trace captured"]
  ])("classifies %s taxonomy signals", async (kind, failedStep, logExcerpt) => {
    const classification = await createHeuristicClassifier().classify({
      ...baseEvent,
      failedStep,
      logExcerpt
    });

    expect(classification.kind).toBe(kind);
    expect(classification.risk).toBe("medium");
    expect(classification.requiresHuman).toBe(true);
  });

  it("selects the heuristic provider by default", () => {
    const classifier = createFailureClassifier(loadEnv({ NODE_ENV: "test" }));

    expect(classifier).toBeDefined();
  });
});
