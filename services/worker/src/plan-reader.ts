import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { RepairPlan } from "@loopci/contracts";
import { repairPlanSchema } from "@loopci/contracts";

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export interface WorkerPlanStore {
  claimNext(): Promise<RepairPlan | null>;
  update(plan: RepairPlan): Promise<void>;
  list(): Promise<RepairPlan[]>;
}

export function createWorkerPlanStore(filePath: string): WorkerPlanStore {
  async function list(): Promise<RepairPlan[]> {
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

  async function writeAll(plans: RepairPlan[]): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    const contents = plans.map((plan) => JSON.stringify(plan)).join("\n");
    await writeFile(`${filePath}.tmp`, contents ? `${contents}\n` : "", "utf8");
    await rename(`${filePath}.tmp`, filePath);
  }

  return {
    list,
    claimNext: async () => {
      const plans = await list();
      const index = plans.findIndex((plan) => plan.status === "queued");

      if (index === -1) {
        return null;
      }

      const plan = plans[index];
      if (!plan) {
        return null;
      }

      const claimed = { ...plan, status: "claimed" as const };
      plans[index] = claimed;
      await writeAll(plans);
      return claimed;
    },
    update: async (plan) => {
      const plans = await list();
      const index = plans.findIndex((candidate) => candidate.id === plan.id);

      if (index === -1) {
        throw new Error(`Repair plan not found: ${plan.id}`);
      }

      plans[index] = plan;
      await writeAll(plans);
    }
  };
}
