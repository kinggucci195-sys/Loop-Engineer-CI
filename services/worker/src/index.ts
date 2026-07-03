import { resolve } from "node:path";
import { loadEnv } from "@loopci/config";
import { createLogger } from "@loopci/logger";
import { createWorkerPlanStore } from "./plan-reader";
import { createJsonEvidenceStore } from "./state/evidence-store";
import { runWorkerLoop } from "./worker-loop";

async function main() {
  const env = loadEnv();
  const logger = createLogger();
  const planPath = resolve(process.cwd(), env.STATE_DIR, "plans.jsonl");
  const evidencePath = resolve(process.cwd(), env.STATE_DIR, "evidence");

  logger.info(
    {
      pollIntervalMs: env.WORKER_POLL_INTERVAL_MS
    },
    "LoopCI worker started"
  );

  await runWorkerLoop({
    planStore: createWorkerPlanStore(planPath),
    evidenceStore: createJsonEvidenceStore(evidencePath),
    logger,
    pollIntervalMs: env.WORKER_POLL_INTERVAL_MS
  });
}

main().catch((error: unknown) => {
  const logger = createLogger();
  logger.error({ error }, "LoopCI worker failed");
  process.exit(1);
});
