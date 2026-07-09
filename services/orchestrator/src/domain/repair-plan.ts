import type {
  CiFailureEvent,
  FailureClassification,
  RepairPlan
} from "@loopci/contracts";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function createRepairPlan(
  event: CiFailureEvent,
  classification: FailureClassification
): RepairPlan {
  const safeSlug = slugify(
    `${classification.kind}-${event.failedJob}-${event.runId}`
  );
  const humanRequired =
    classification.requiresHuman || classification.risk !== "low";

  return {
    id: `plan-${event.runId}-${Date.now()}`,
    event,
    classification,
    status: humanRequired ? "blocked" : "queued",
    branchName: `loopci/${safeSlug}`,
    goal: buildGoal(classification),
    steps: buildSteps(classification),
    evidenceRequired: [
      "Exact failed command output after the fix",
      "Relevant regression test output",
      "Summary of changed files and residual risk"
    ],
    residualRisk:
      "Passing CI is necessary evidence, but human review is still required before merge.",
    createdAt: new Date().toISOString()
  };
}

function buildGoal(classification: FailureClassification): string {
  if (classification.kind === "lint" || classification.kind === "format") {
    return "Make formatting and lint checks pass without changing runtime behavior.";
  }

  if (classification.kind === "typecheck") {
    return "Make TypeScript checks pass with explicit types and no weakening of strictness.";
  }

  if (classification.kind === "dependency") {
    return "Restore dependency installation or resolution without widening package risk.";
  }

  if (classification.kind === "environment") {
    return "Identify the missing runner, secret, or environment assumption before changing application code.";
  }

  if (
    classification.kind === "unit-test" ||
    classification.kind === "integration-test" ||
    classification.kind === "e2e-test"
  ) {
    return "Reproduce the failed test signal, isolate whether it is product behavior or test instability, and propose the smallest safe repair.";
  }

  if (classification.kind === "flaky-or-noisy") {
    return "Confirm whether the failure is flaky and propose quarantine or rerun policy evidence.";
  }

  return "Repair the CI failure with the smallest safe diff and keep merge authority with a human.";
}

function buildSteps(classification: FailureClassification): string[] {
  return [
    "Reproduce the failing signal from the captured CI logs.",
    ...classification.recommendedChecks.map((check) => `Run: ${check}`),
    "Prepare a small patch or escalation note.",
    "Run evaluator checks and attach evidence before requesting review."
  ];
}
