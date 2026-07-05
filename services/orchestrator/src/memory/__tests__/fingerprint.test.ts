import type { CiFailureEvent, FailureClassification } from "@loopci/contracts";
import { createFailureFingerprint } from "../fingerprint";

const baseEvent: CiFailureEvent = {
  provider: "github-actions",
  repository: "kinggucci195-sys/loopci",
  workflow: "ci",
  runId: "1001",
  runUrl: "https://github.com/kinggucci195-sys/loopci/actions/runs/1001",
  commitSha: "abcdef1",
  branch: "main",
  failedJob: "validate",
  failedStep: "npm test",
  logExcerpt:
    "2026-07-05T10:12:33Z https://example.com/build/123 abcdef123456 src/index.ts:12:8 Expected status 200"
};

const baseClassification: FailureClassification = {
  kind: "unit-test",
  risk: "medium",
  confidence: 0.72,
  summary: "Unit test failed.",
  likelyFiles: ["src/index.ts"],
  recommendedChecks: ["npm test"],
  requiresHuman: true,
  rationale: "Detected assertion failure."
};

describe("createFailureFingerprint", () => {
  it("creates the same fingerprint for identical CI failure inputs", () => {
    const first = createFailureFingerprint(baseEvent, baseClassification);
    const second = createFailureFingerprint(baseEvent, baseClassification);

    expect(first.id).toBe(second.id);
    expect(first.signature).toBe(second.signature);
  });

  it("ignores noisy timestamps, urls, shas, run ids, and line numbers", () => {
    const first = createFailureFingerprint(baseEvent, baseClassification);
    const second = createFailureFingerprint(
      {
        ...baseEvent,
        runId: "9999",
        runUrl: "https://github.com/kinggucci195-sys/loopci/actions/runs/9999",
        commitSha: "1234567",
        logExcerpt:
          "2026-07-06T11:44:55Z https://other.example/run/888 123456789abc src/index.ts:44:19 Expected status 200"
      },
      baseClassification
    );

    expect(second.id).toBe(first.id);
  });

  it("changes when the failure kind or failed step changes", () => {
    const base = createFailureFingerprint(baseEvent, baseClassification);
    const differentKind = createFailureFingerprint(baseEvent, {
      ...baseClassification,
      kind: "typecheck"
    });
    const differentStep = createFailureFingerprint(
      {
        ...baseEvent,
        failedStep: "npm run typecheck"
      },
      baseClassification
    );

    expect(differentKind.id).not.toBe(base.id);
    expect(differentStep.id).not.toBe(base.id);
  });
});
