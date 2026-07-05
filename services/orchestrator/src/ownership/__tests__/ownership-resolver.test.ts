import type { CiFailureEvent, FailureClassification } from "@loopci/contracts";
import { createFallbackOwnershipResolver } from "../ownership-resolver";

const classification: FailureClassification = {
  kind: "lint",
  risk: "low",
  confidence: 0.72,
  summary: "Lint failed.",
  likelyFiles: ["src/index.ts"],
  recommendedChecks: ["npm run lint"],
  requiresHuman: false,
  rationale: "Known lint signature."
};

const event: CiFailureEvent = {
  provider: "github-actions",
  repository: "kinggucci195-sys/loopci",
  workflow: "ci",
  runId: "1001",
  runUrl: "https://github.com/kinggucci195-sys/loopci/actions/runs/1001",
  commitSha: "abcdef1",
  branch: "main",
  actor: "actor-user",
  triggeringActor: "trigger-user",
  commitAuthorEmail: "author@example.com",
  failedJob: "validate",
  failedStep: "npm run lint",
  logExcerpt: "ESLint no-console violation in src/index.ts"
};

describe("createFallbackOwnershipResolver", () => {
  it("prefers triggering actor over actor and commit author email", async () => {
    await expect(
      createFallbackOwnershipResolver().resolve(event, classification)
    ).resolves.toEqual({
      owner: "trigger-user",
      source: "triggering-actor"
    });
  });

  it("falls back through actor, commit author email, then unknown", async () => {
    const resolver = createFallbackOwnershipResolver();

    await expect(
      resolver.resolve({ ...event, triggeringActor: undefined }, classification)
    ).resolves.toEqual({
      owner: "actor-user",
      source: "actor"
    });
    await expect(
      resolver.resolve(
        { ...event, triggeringActor: undefined, actor: undefined },
        classification
      )
    ).resolves.toEqual({
      owner: "author@example.com",
      source: "commit-author-email"
    });
    await expect(
      resolver.resolve(
        {
          ...event,
          triggeringActor: undefined,
          actor: undefined,
          commitAuthorEmail: undefined
        },
        classification
      )
    ).resolves.toEqual({
      source: "unknown"
    });
  });
});
