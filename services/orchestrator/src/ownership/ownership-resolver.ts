import type {
  CiFailureEvent,
  FailureClassification,
  OwnershipSnapshot
} from "@loopci/contracts";
import { readFile } from "node:fs/promises";

export type OwnershipResolution = OwnershipSnapshot;

export interface OwnershipResolver {
  resolve(
    event: CiFailureEvent,
    classification: FailureClassification
  ): Promise<OwnershipResolution>;
}

interface CodeownersRule {
  pattern: string;
  owners: string[];
}

export interface CodeownersOwnershipResolverOptions {
  codeownersPath?: string | undefined;
  fallback?: OwnershipResolver | undefined;
}

export function createOwnershipResolver(
  options: CodeownersOwnershipResolverOptions = {}
): OwnershipResolver {
  const fallback = options.fallback ?? createFallbackOwnershipResolver();

  if (!options.codeownersPath) {
    return fallback;
  }

  return createCodeownersOwnershipResolver({
    codeownersPath: options.codeownersPath,
    fallback
  });
}

export function createCodeownersOwnershipResolver({
  codeownersPath,
  fallback = createFallbackOwnershipResolver()
}: {
  codeownersPath: string;
  fallback?: OwnershipResolver;
}): OwnershipResolver {
  let cachedRules: CodeownersRule[] | undefined;

  async function loadRules(): Promise<CodeownersRule[]> {
    if (cachedRules) {
      return cachedRules;
    }

    try {
      cachedRules = parseCodeowners(await readFile(codeownersPath, "utf8"));
    } catch {
      cachedRules = [];
    }

    return cachedRules;
  }

  return {
    resolve: async (event, classification) => {
      const rules = await loadRules();
      const files = classification.likelyFiles;
      const match = findCodeownersMatch(rules, files);
      const owner = match?.owners[0];

      if (owner) {
        return {
          owner,
          source: "codeowners"
        };
      }

      return fallback.resolve(event, classification);
    }
  };
}

export function createFallbackOwnershipResolver(): OwnershipResolver {
  return {
    resolve: async (event) => {
      if (event.triggeringActor) {
        return {
          owner: event.triggeringActor,
          source: "triggering-actor"
        };
      }

      if (event.actor) {
        return {
          owner: event.actor,
          source: "actor"
        };
      }

      if (event.commitAuthorEmail) {
        return {
          owner: event.commitAuthorEmail,
          source: "commit-author-email"
        };
      }

      return {
        source: "unknown"
      };
    }
  };
}

export function parseCodeowners(contents: string): CodeownersRule[] {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts.length >= 2)
    .flatMap(([pattern, ...owners]) =>
      pattern
        ? [
            {
              pattern,
              owners: owners.map(normalizeOwner).filter(Boolean)
            }
          ]
        : []
    )
    .filter((rule) => rule.owners.length > 0);
}

function findCodeownersMatch(
  rules: CodeownersRule[],
  files: string[]
): CodeownersRule | undefined {
  for (const file of files) {
    for (const rule of [...rules].reverse()) {
      if (matchesCodeownersPattern(rule.pattern, file)) {
        return rule;
      }
    }
  }

  return undefined;
}

function matchesCodeownersPattern(pattern: string, file: string): boolean {
  const normalizedPattern = pattern.replace(/\\/g, "/");
  const normalizedFile = file.replace(/\\/g, "/").replace(/^\.?\//, "");
  const rootlessPattern = normalizedPattern.replace(/^\/+/, "");

  if (rootlessPattern.endsWith("/")) {
    return normalizedFile.startsWith(rootlessPattern);
  }

  if (!rootlessPattern.includes("*")) {
    return (
      normalizedFile === rootlessPattern ||
      normalizedFile.startsWith(`${rootlessPattern}/`) ||
      normalizedFile.endsWith(`/${rootlessPattern}`)
    );
  }

  const regex = new RegExp(
    `^${rootlessPattern
      .split("*")
      .map(escapeRegExp)
      .join("[^/]*")}$`
  );
  return regex.test(normalizedFile);
}

function normalizeOwner(owner: string): string {
  return owner.replace(/^@/, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
