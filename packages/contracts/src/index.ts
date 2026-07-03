import { z } from "zod";

export const ciProviderSchema = z.enum([
  "github-actions",
  "gitlab-ci",
  "circleci",
  "local"
]);

export const failureKindSchema = z.enum([
  "format",
  "lint",
  "typecheck",
  "unit-test",
  "integration-test",
  "e2e-test",
  "dependency",
  "environment",
  "workflow-config",
  "secret-or-permission",
  "flaky-or-noisy",
  "unknown"
]);

export const riskLevelSchema = z.enum(["low", "medium", "high"]);

export const ciFailureEventSchema = z.object({
  provider: ciProviderSchema,
  repository: z.string().min(1),
  workflow: z.string().min(1),
  runId: z.string().min(1),
  runUrl: z.string().url(),
  commitSha: z.string().min(6),
  branch: z.string().min(1),
  failedJob: z.string().min(1),
  failedStep: z.string().min(1),
  logExcerpt: z.string().min(1).max(12000),
  receivedAt: z.string().datetime().optional()
});

export const classificationSchema = z.object({
  kind: failureKindSchema,
  risk: riskLevelSchema,
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1),
  likelyFiles: z.array(z.string()).default([]),
  recommendedChecks: z.array(z.string()).default([]),
  requiresHuman: z.boolean(),
  rationale: z.string().min(1)
});

export const repairPlanSchema = z.object({
  id: z.string().min(1),
  event: ciFailureEventSchema,
  classification: classificationSchema,
  status: z.enum(["queued", "planning", "blocked", "ready-for-review"]),
  branchName: z.string().min(1),
  goal: z.string().min(1),
  steps: z.array(z.string()).min(1),
  evidenceRequired: z.array(z.string()).min(1),
  residualRisk: z.string().min(1),
  createdAt: z.string().datetime()
});

export type CiProvider = z.infer<typeof ciProviderSchema>;
export type FailureKind = z.infer<typeof failureKindSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type CiFailureEvent = z.infer<typeof ciFailureEventSchema>;
export type FailureClassification = z.infer<typeof classificationSchema>;
export type RepairPlan = z.infer<typeof repairPlanSchema>;
