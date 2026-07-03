import { mkdir, appendFile, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { RepairPlan } from "@loopci/contracts";
import { repairPlanSchema } from "@loopci/contracts";

export interface PlanStore {
  append(plan: RepairPlan): Promise<void>;
  list(): Promise<RepairPlan[]>;
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export function createJsonlPlanStore(filePath: string): PlanStore {
  return {
    append: async (plan) => {
      await mkdir(dirname(filePath), { recursive: true });
      await appendFile(filePath, `${JSON.stringify(plan)}\n`, "utf8");
    },
    list: async () => {
      try {
        const contents = await readFile(filePath, "utf8");
        return contents
          .split("\n")
          .filter(Boolean)
          .map((line) => repairPlanSchema.parse(JSON.parse(line)));
      } catch (error) {
        if (isMissingFileError(error)) {
          return [];
        }

        throw error;
      }
    }
  };
}
