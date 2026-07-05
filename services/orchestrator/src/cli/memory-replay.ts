import { resolve } from "node:path";
import { loadEnv } from "@loopci/config";
import { createLogger } from "@loopci/logger";
import { createJsonlMemoryStore } from "../memory/memory-store";
import type { MemoryReplayFilter } from "../memory/replay";
import { replayMemoryProjections } from "../memory/replay";

async function main() {
  const env = loadEnv();
  const logger = createLogger();
  const filter = parseReplayFilter(process.argv.slice(2));
  const records = await replayMemoryProjections(
    createJsonlMemoryStore({
      eventsPath: resolve(env.STATE_DIR, "memory-events.jsonl"),
      recordsPath: resolve(env.STATE_DIR, "memory.jsonl")
    }),
    filter
  );

  logger.info(
    { filter, projectionCount: records.length },
    "Rebuilt LoopCI memory projections"
  );
}

main().catch((error: unknown) => {
  const logger = createLogger();
  logger.error({ error }, "Failed to rebuild LoopCI memory projections");
  process.exit(1);
});

function parseReplayFilter(args: string[]): MemoryReplayFilter {
  const filter: MemoryReplayFilter = {};

  for (const arg of args) {
    const [name, value] = arg.split("=");

    if (!value) {
      throw new Error(
        "Usage: npm run memory:replay --workspace @loopci/orchestrator -- [--repository=owner/repo] [--fingerprint-id=fp-id] [--from=iso-date] [--to=iso-date]"
      );
    }

    if (name === "--repository") {
      filter.repository = value;
    } else if (name === "--fingerprint-id") {
      filter.fingerprintId = value;
    } else if (name === "--from") {
      filter.occurredAtFrom = value;
    } else if (name === "--to") {
      filter.occurredAtTo = value;
    } else {
      throw new Error(`Unknown memory replay option: ${name}`);
    }
  }

  return filter;
}
