import { resolve } from "node:path";
import { loadEnv } from "@loopci/config";
import { createLogger } from "@loopci/logger";
import { createFailureClassifier } from "./ai/classifier";
import { buildServer } from "./server";
import { createJsonlPlanStore } from "./state/plan-store";

async function main() {
  const env = loadEnv();
  const logger = createLogger();
  const server = buildServer({
    env,
    classifier: createFailureClassifier(env),
    planStore: createJsonlPlanStore(resolve(process.cwd(), "../../state/plans.jsonl"))
  });

  await server.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info({ port: env.PORT }, "LoopCI orchestrator started");
}

main().catch((error: unknown) => {
  const logger = createLogger();
  logger.error({ error }, "LoopCI orchestrator failed to start");
  process.exit(1);
});
