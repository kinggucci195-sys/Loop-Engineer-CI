import { resolve } from "node:path";
import { loadEnv } from "@loopci/config";
import { createLogger } from "@loopci/logger";
import { createJsonlMemoryStore } from "../memory/memory-store";
import { replayMemoryProjections } from "../memory/replay";

async function main() {
  const env = loadEnv();
  const logger = createLogger();
  const records = await replayMemoryProjections(
    createJsonlMemoryStore({
      eventsPath: resolve(env.STATE_DIR, "memory-events.jsonl"),
      recordsPath: resolve(env.STATE_DIR, "memory.jsonl")
    })
  );

  logger.info(
    { projectionCount: records.length },
    "Rebuilt LoopCI memory projections"
  );
}

main().catch((error: unknown) => {
  const logger = createLogger();
  logger.error({ error }, "Failed to rebuild LoopCI memory projections");
  process.exit(1);
});
