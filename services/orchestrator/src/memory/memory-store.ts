import {
  appendFile,
  mkdir,
  readFile,
  rename,
  writeFile
} from "node:fs/promises";
import { dirname } from "node:path";
import {
  engineeringMemoryEventSchema,
  engineeringMemoryRecordSchema,
  type EngineeringMemoryEvent,
  type EngineeringMemoryRecord
} from "@loopci/contracts";

export interface MemoryStore {
  appendEvent(event: EngineeringMemoryEvent): Promise<void>;
  listEvents(): Promise<EngineeringMemoryEvent[]>;
  listEventsByMemoryId(memoryId: string): Promise<EngineeringMemoryEvent[]>;
  listEventsByFingerprintId(
    fingerprintId: string
  ): Promise<EngineeringMemoryEvent[]>;
  listRecords(): Promise<EngineeringMemoryRecord[]>;
  getRecord(id: string): Promise<EngineeringMemoryRecord | null>;
  getRecordByFingerprintId(
    fingerprintId: string
  ): Promise<EngineeringMemoryRecord | null>;
  writeProjection(record: EngineeringMemoryRecord): Promise<void>;
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export function createJsonlMemoryStore(input: {
  eventsPath: string;
  recordsPath: string;
}): MemoryStore {
  async function listEvents(): Promise<EngineeringMemoryEvent[]> {
    return readJsonl(input.eventsPath, (value) =>
      engineeringMemoryEventSchema.parse(value)
    );
  }

  async function listRecords(): Promise<EngineeringMemoryRecord[]> {
    return readJsonl(input.recordsPath, (value) =>
      engineeringMemoryRecordSchema.parse(value)
    );
  }

  async function writeAllRecords(records: EngineeringMemoryRecord[]) {
    await mkdir(dirname(input.recordsPath), { recursive: true });
    const contents = records.map((record) => JSON.stringify(record)).join("\n");
    await writeFile(
      `${input.recordsPath}.tmp`,
      contents ? `${contents}\n` : "",
      "utf8"
    );
    await rename(`${input.recordsPath}.tmp`, input.recordsPath);
  }

  return {
    appendEvent: async (event) => {
      await mkdir(dirname(input.eventsPath), { recursive: true });
      await appendFile(input.eventsPath, `${JSON.stringify(event)}\n`, "utf8");
    },
    listEvents,
    listEventsByMemoryId: async (memoryId) =>
      (await listEvents()).filter((event) => event.memoryId === memoryId),
    listEventsByFingerprintId: async (fingerprintId) =>
      (await listEvents()).filter(
        (event) => event.fingerprintId === fingerprintId
      ),
    listRecords,
    getRecord: async (id) =>
      (await listRecords()).find((record) => record.id === id) ?? null,
    getRecordByFingerprintId: async (fingerprintId) =>
      (await listRecords()).find(
        (record) => record.fingerprintId === fingerprintId
      ) ?? null,
    writeProjection: async (record) => {
      const records = await listRecords();
      const index = records.findIndex(
        (candidate) => candidate.id === record.id
      );

      if (index === -1) {
        records.push(record);
      } else {
        records[index] = record;
      }

      await writeAllRecords(records);
    }
  };
}

async function readJsonl<T>(
  filePath: string,
  parse: (value: unknown) => T
): Promise<T[]> {
  try {
    const contents = await readFile(filePath, "utf8");
    return contents
      .split("\n")
      .filter(Boolean)
      .map((line) => parse(JSON.parse(line)));
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}
