import type { EvidenceBundle, RepairPlan } from "@loopci/contracts";

export function buildEvidenceBundle(plan: RepairPlan): EvidenceBundle {
  const commandsToRun = Array.from(
    new Set([
      ...plan.classification.recommendedChecks,
      ...plan.evidenceRequired
        .filter((item) => item.toLowerCase().includes("command"))
        .map(() => plan.event.failedStep)
    ])
  );

  return {
    planId: plan.id,
    repository: plan.event.repository,
    branchName: plan.branchName,
    summary: `${plan.classification.kind} failure in ${plan.event.workflow}/${plan.event.failedJob}.`,
    commandsToRun,
    requiredHumanChecks: [
      "Confirm the patch does not weaken tests or hide failures.",
      "Review any CI workflow or permissions changes manually.",
      "Approve merge only after required checks pass."
    ],
    riskNotes: [
      plan.residualRisk,
      `Risk level: ${plan.classification.risk}`,
      `Classifier confidence: ${plan.classification.confidence}`
    ],
    createdAt: new Date().toISOString()
  };
}
