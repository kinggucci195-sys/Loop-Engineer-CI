import { readFile } from "node:fs/promises";
import {
  failureKindSchema,
  riskLevelSchema,
  type CiFailureEvent,
  type FailureClassification,
  type FailureKind,
  type RiskLevel
} from "@loopci/contracts";
import { z } from "zod";

const repositoryPolicyFields = {
  enabled: z.boolean().default(true),
  allowedBranches: z.array(z.string().min(1)).default(["main"]),
  lowRiskKinds: z
    .array(failureKindSchema)
    .default(["format", "lint", "typecheck", "unit-test"]),
  maxLogExcerptChars: z.number().int().positive().max(12000).default(6000),
  requireHumanReviewForRisk: z
    .array(riskLevelSchema)
    .default(["medium", "high"]),
  requireHumanReviewForKinds: z
    .array(failureKindSchema)
    .default([
      "dependency",
      "environment",
      "workflow-config",
      "secret-or-permission",
      "unknown"
    ]),
  autoCreateIssue: z.boolean().default(false),
  autoCommentOnPr: z.boolean().default(false)
};

export const repositoryPolicySchema = z.object({
  repository: z.string().min(1),
  ...repositoryPolicyFields
});

const repositoryPolicyDefaultsSchema = z
  .object(repositoryPolicyFields)
  .partial();

export const loopCiPolicyConfigSchema = z.object({
  defaults: repositoryPolicyDefaultsSchema.default({}),
  repositories: z.array(repositoryPolicySchema).default([])
});

export type RepositoryPolicy = z.infer<typeof repositoryPolicySchema>;
export type LoopCiPolicyConfig = z.infer<typeof loopCiPolicyConfigSchema>;

export interface RepositoryPolicyProvider {
  getPolicy(repository: string): Promise<RepositoryPolicy>;
}

const safeDefaults = repositoryPolicyDefaultsSchema.parse({});

export function createDefaultRepositoryPolicy(
  repository: string
): RepositoryPolicy {
  return repositoryPolicySchema.parse({
    repository,
    ...safeDefaults
  });
}

export function createFileRepositoryPolicyProvider(
  filePath: string | undefined
): RepositoryPolicyProvider {
  let cached: Promise<LoopCiPolicyConfig> | undefined;

  async function loadConfig(): Promise<LoopCiPolicyConfig> {
    if (!filePath) {
      return loopCiPolicyConfigSchema.parse({});
    }

    const raw = await readFile(filePath, "utf8");
    return loopCiPolicyConfigSchema.parse(JSON.parse(raw));
  }

  return {
    getPolicy: async (repository) => {
      cached ??= loadConfig();
      const config = await cached;
      const match = config.repositories.find(
        (candidate) => candidate.repository === repository
      );

      return repositoryPolicySchema.parse({
        repository,
        ...safeDefaults,
        ...config.defaults,
        ...match
      });
    }
  };
}

export function isBranchAllowed(
  policy: RepositoryPolicy,
  branch: string
): boolean {
  return policy.allowedBranches.some((pattern) =>
    matchesBranch(pattern, branch)
  );
}

export function enforceRepositoryPolicy(
  event: CiFailureEvent,
  classification: FailureClassification,
  policy: RepositoryPolicy
): FailureClassification {
  const riskRequiresHuman = includesRisk(
    policy.requireHumanReviewForRisk,
    classification.risk
  );
  const kindRequiresHuman = includesKind(
    policy.requireHumanReviewForKinds,
    classification.kind
  );
  const kindIsLowRisk = includesKind(policy.lowRiskKinds, classification.kind);

  return {
    ...classification,
    requiresHuman:
      classification.requiresHuman ||
      riskRequiresHuman ||
      kindRequiresHuman ||
      !kindIsLowRisk ||
      !isBranchAllowed(policy, event.branch)
  };
}

export function applyLogLimit(
  event: CiFailureEvent,
  policy: RepositoryPolicy
): CiFailureEvent {
  if (event.logExcerpt.length <= policy.maxLogExcerptChars) {
    return event;
  }

  const suffix = "\n[LoopCI truncated log excerpt by repository policy]";
  const bodyLimit = Math.max(1, policy.maxLogExcerptChars - suffix.length);

  return {
    ...event,
    logExcerpt: `${event.logExcerpt.slice(0, bodyLimit)}${suffix}`
  };
}

function matchesBranch(pattern: string, branch: string): boolean {
  if (pattern === "*" || pattern === branch) {
    return true;
  }

  if (pattern.endsWith("/*")) {
    return branch.startsWith(pattern.slice(0, -1));
  }

  return false;
}

function includesRisk(values: RiskLevel[], value: RiskLevel): boolean {
  return values.includes(value);
}

function includesKind(values: FailureKind[], value: FailureKind): boolean {
  return values.includes(value);
}
