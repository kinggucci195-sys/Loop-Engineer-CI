import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { repairPlanSchema } from "@loopci/contracts";
import { loadEnv } from "@loopci/config";
import { createLogger } from "@loopci/logger";
import { buildEvidenceBundle } from "./evidence/evidence-bundle";

async function readPlans(filePath: string) {
  try {
    const contents = await readFile(filePath, "utf8");
    return contents
      .split("\n")
      .filter(Boolean)
      .map((line) => repairPlanSchema.parse(JSON.parse(line)));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function main() {
  const env = loadEnv();
  const logger = createLogger();
  const planPath = resolve(process.cwd(), "../../state/plans.jsonl");
  const plans = await readPlans(planPath);
  const bundles = plans.map(buildEvidenceBundle);

  logger.info(
    {
      pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
      plans: plans.length,
      bundles: bundles.length
    },
    "LoopCI worker inspected repair plans"
  );
}

main().catch((error: unknown) => {
  const logger = createLogger();
  logger.error({ error }, "LoopCI worker failed");
  process.exit(1);
});
