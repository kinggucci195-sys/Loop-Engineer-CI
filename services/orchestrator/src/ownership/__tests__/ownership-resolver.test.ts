import type { CiFailureEvent, FailureClassification } from "@loopci/contracts";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createCodeownersOwnershipResolver,
  createFallbackOwnershipResolver,
  parseCodeowners
} from "../ownership-resolver";

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

describe("createCodeownersOwnershipResolver", () => {
  it("parses CODEOWNERS rules without comments or empty lines", () => {
    expect(
      parseCodeowners(`
# Platform ownership
/services/orchestrator/ @platform
apps/web/*.tsx @frontend @design
`)
    ).toEqual([
      {
        pattern: "/services/orchestrator/",
        owners: ["platform"]
      },
      {
        pattern: "apps/web/*.tsx",
        owners: ["frontend", "design"]
      }
    ]);
  });

  it("prefers the last matching CODEOWNERS rule for likely failed files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "loopci-codeowners-"));
    const codeownersPath = join(directory, "CODEOWNERS");
    await writeFile(
      codeownersPath,
      `
* @everyone
/services/orchestrator/ @platform
services/orchestrator/src/server.ts @runtime
`
    );

    const resolver = createCodeownersOwnershipResolver({
      codeownersPath,
      fallback: createFallbackOwnershipResolver()
    });

    await expect(
      resolver.resolve(
        event,
        {
          ...classification,
          likelyFiles: ["services/orchestrator/src/server.ts"]
        }
      )
    ).resolves.toEqual({
      owner: "runtime",
      source: "codeowners"
    });
  });

  it("falls back when CODEOWNERS does not match likely files", async () => {
    const directory = await mkdtemp(join(tmpdir(), "loopci-codeowners-"));
    const codeownersPath = join(directory, "CODEOWNERS");
    await writeFile(codeownersPath, "/apps/web/ @frontend");

    const resolver = createCodeownersOwnershipResolver({
      codeownersPath,
      fallback: createFallbackOwnershipResolver()
    });

    await expect(resolver.resolve(event, classification)).resolves.toEqual({
      owner: "trigger-user",
      source: "triggering-actor"
    });
  });
});
