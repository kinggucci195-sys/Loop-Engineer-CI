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
  actor: z.string().min(1).optional(),
  triggeringActor: z.string().min(1).optional(),
  commitAuthorName: z.string().min(1).optional(),
  commitAuthorEmail: z.string().email().optional(),
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
  memoryRecordId: z.string().min(1).optional(),
  event: ciFailureEventSchema,
  classification: classificationSchema,
  status: z.enum([
    "classified",
    "queued",
    "claimed",
    "planning",
    "evaluating",
    "evidence-attached",
    "blocked",
    "ready-for-review",
    "rejected",
    "closed"
  ]),
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

export const evidenceBundleSchema = z.object({
  planId: z.string().min(1),
  repository: z.string().min(1),
  branchName: z.string().min(1),
  summary: z.string().min(1),
  commandsToRun: z.array(z.string()).default([]),
  requiredHumanChecks: z.array(z.string()).min(1),
  riskNotes: z.array(z.string()).min(1),
  createdAt: z.string().datetime()
});

export type EvidenceBundle = z.infer<typeof evidenceBundleSchema>;

export const fingerprintTypeSchema = z.enum(["ci-failure"]);

export const fingerprintSchema = z.object({
  id: z.string().min(1),
  type: fingerprintTypeSchema,
  version: z.literal(1),
  signature: z.string().min(1)
});

export const failureFingerprintSchema = fingerprintSchema.extend({
  type: z.literal("ci-failure"),
  repository: z.string().min(1),
  workflow: z.string().min(1),
  job: z.string().min(1),
  step: z.string().min(1),
  kind: failureKindSchema,
  normalizedSignature: z.string().min(1),
  likelyFiles: z.array(z.string()).default([])
});

export const fingerprintSnapshotSchema = fingerprintSchema.extend({
  source: z.record(z.string(), z.unknown()).default({})
});

export const engineeringMemoryOutcomeSchema = z.enum([
  "unknown",
  "fix-requested",
  "verified-fix",
  "failed-repair",
  "regressed"
]);

export const engineeringMemoryEventTypeSchema = z.enum([
  "failure-observed",
  "repair-requested",
  "repair-succeeded",
  "repair-failed",
  "regression-detected"
]);

export const engineeringMemoryLifecycleStateSchema = z.enum([
  "active",
  "archived",
  "superseded"
]);

const nullableRelationshipSchema = z.string().min(1).nullable().optional();

export const engineeringMemoryRelationshipsSchema = z.object({
  repository: nullableRelationshipSchema,
  workflow: nullableRelationshipSchema,
  commitSha: z.string().min(6).nullable().optional(),
  pullRequest: nullableRelationshipSchema,
  ticket: nullableRelationshipSchema,
  deployment: nullableRelationshipSchema,
  incident: nullableRelationshipSchema,
  owner: nullableRelationshipSchema,
  files: z.array(z.string()).default([]),
  repairPlanIds: z.array(z.string()).default([])
});

export const engineeringMemoryEventSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  type: engineeringMemoryEventTypeSchema,
  idempotencyKey: z.string().min(1),
  source: z.string().min(1),
  sourceEventId: z.string().min(1).optional(),
  memoryId: z.string().min(1),
  fingerprintId: z.string().min(1),
  fingerprintType: fingerprintTypeSchema,
  fingerprintVersion: z.literal(1),
  fingerprint: fingerprintSnapshotSchema,
  correlationId: z.string().min(1),
  causationId: z.string().min(1).optional(),
  actor: z.string().min(1).optional(),
  planId: z.string().min(1).optional(),
  occurredAt: z.string().datetime(),
  relationships: engineeringMemoryRelationshipsSchema.default({}),
  outcome: engineeringMemoryOutcomeSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
});

/**
 * EngineeringMemoryRecord is a rebuildable projection.
 * EngineeringMemoryEvent is the source of truth.
 *
 * v1 stores CI failures.
 * Future versions may store deployments, pull requests, incidents,
 * reviews, rollbacks, approvals, and repair outcomes.
 */
export const engineeringMemoryRecordSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  recordType: z.literal("ci-failure"),
  fingerprintId: z.string().min(1),
  fingerprintType: fingerprintTypeSchema,
  fingerprintVersion: z.literal(1),
  lifecycleState: engineeringMemoryLifecycleStateSchema,
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  firstObservedAt: z.string().datetime(),
  lastObservedAt: z.string().datetime(),
  lastUpdatedAt: z.string().datetime(),
  relationships: engineeringMemoryRelationshipsSchema,
  outcomes: z.array(engineeringMemoryOutcomeSchema).default([]),
  occurrenceCount: z.number().int().nonnegative(),
  previousRepairCount: z.number().int().nonnegative().default(0),
  lastSuccessfulRepairPlanId: z.string().min(1).optional()
});

export const engineeringRecognitionTypeSchema = z.enum(["exact-fingerprint"]);

export const engineeringRecognitionSummarySchema = z.object({
  seenBefore: z.boolean(),
  recurring: z.boolean(),
  recognitionType: engineeringRecognitionTypeSchema,
  occurrenceCount: z.number().int().nonnegative(),
  previousRepairCount: z.number().int().nonnegative(),
  lastSuccessfulRepairPlanId: z.string().min(1).optional(),
  likelyPriorFixer: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1),
  confidenceReasoning: z.array(z.string()).default([])
});

export type Fingerprint = z.infer<typeof fingerprintSchema>;
export type FailureFingerprint = z.infer<typeof failureFingerprintSchema>;
export type FingerprintSnapshot = z.infer<typeof fingerprintSnapshotSchema>;
export type EngineeringMemoryOutcome = z.infer<
  typeof engineeringMemoryOutcomeSchema
>;
export type EngineeringMemoryLifecycleState = z.infer<
  typeof engineeringMemoryLifecycleStateSchema
>;
export type EngineeringMemoryEventType = z.infer<
  typeof engineeringMemoryEventTypeSchema
>;
export type EngineeringMemoryRelationships = z.infer<
  typeof engineeringMemoryRelationshipsSchema
>;
export type EngineeringMemoryEvent = z.infer<
  typeof engineeringMemoryEventSchema
>;
export type EngineeringMemoryRecord = z.infer<
  typeof engineeringMemoryRecordSchema
>;
export type EngineeringRecognitionSummary = z.infer<
  typeof engineeringRecognitionSummarySchema
>;
