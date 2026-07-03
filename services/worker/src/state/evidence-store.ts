import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { EvidenceBundle } from "@loopci/contracts";

export interface EvidenceStore {
  write(bundle: EvidenceBundle): Promise<string>;
}

export function createJsonEvidenceStore(directoryPath: string): EvidenceStore {
  return {
    write: async (bundle) => {
      const filePath = join(directoryPath, `${bundle.planId}.json`);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
      return filePath;
    }
  };
}
