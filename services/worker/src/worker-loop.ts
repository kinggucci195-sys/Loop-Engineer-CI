import type { Logger } from "@loopci/logger";
import { buildEvidenceBundle } from "./evidence/evidence-bundle";
import type { EvidenceStore } from "./state/evidence-store";
import type { WorkerPlanStore } from "./plan-reader";

export interface WorkerLoopOptions {
  planStore: WorkerPlanStore;
  evidenceStore: EvidenceStore;
  logger: Logger;
  pollIntervalMs: number;
  runOnce?: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runWorkerLoop(options: WorkerLoopOptions): Promise<void> {
  let shouldContinue = true;

  while (shouldContinue) {
    const plan = await options.planStore.claimNext();

    if (!plan) {
      options.logger.debug({}, "No queued repair plans found");

      if (options.runOnce) {
        return;
      }

      await delay(options.pollIntervalMs);
      continue;
    }

    options.logger.info({ planId: plan.id }, "Claimed repair plan");
    const evaluatingPlan = { ...plan, status: "evaluating" as const };
    await options.planStore.update(evaluatingPlan);

    const bundle = buildEvidenceBundle(evaluatingPlan);
    const evidencePath = await options.evidenceStore.write(bundle);
    const readyPlan = {
      ...evaluatingPlan,
      status: "evidence-attached" as const
    };
    await options.planStore.update(readyPlan);

    options.logger.info(
      { planId: plan.id, evidencePath },
      "Persisted evidence bundle"
    );

    shouldContinue = !options.runOnce;
  }
}
