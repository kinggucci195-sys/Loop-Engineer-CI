import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  EngineeringMemoryEvent,
  EngineeringMemoryRecord
} from "@loopci/contracts";
import { createJsonlMemoryStore } from "../memory-store";

const event: EngineeringMemoryEvent = {
  version: 1,
  id: "memevt-1",
  type: "failure-observed",
  memoryId: "memory-fp-1",
  fingerprintId: "fp-1",
  fingerprintType: "ci-failure",
  fingerprintVersion: 1,
  correlationId: "ci-run:github-actions:kinggucci195-sys/loopci:ci:1001",
  actor: "gerald",
  planId: "plan-1",
  occurredAt: "2026-07-05T00:00:00.000Z",
  relationships: {
    repository: "kinggucci195-sys/loopci",
    workflow: "ci",
    files: ["src/index.ts"],
    repairPlanIds: ["plan-1"]
  },
  outcome: "unknown",
  metadata: {}
};

const record: EngineeringMemoryRecord = {
  schemaVersion: 1,
  id: "memory-fp-1",
  recordType: "ci-failure",
  fingerprintId: "fp-1",
  fingerprintType: "ci-failure",
  fingerprintVersion: 1,
  firstSeenAt: "2026-07-05T00:00:00.000Z",
  lastSeenAt: "2026-07-05T00:00:00.000Z",
  relationships: {
    repository: "kinggucci195-sys/loopci",
    workflow: "ci",
    files: ["src/index.ts"],
    repairPlanIds: ["plan-1"]
  },
  outcomes: ["unknown"],
  occurrenceCount: 1,
  previousRepairCount: 0
};

describe("createJsonlMemoryStore", () => {
  async function createStore() {
    const dir = await mkdtemp(join(tmpdir(), "loopci-memory-"));
    return createJsonlMemoryStore({
      eventsPath: join(dir, "memory-events.jsonl"),
      recordsPath: join(dir, "memory.jsonl")
    });
  }

  it("returns empty events and projections when files are missing", async () => {
    const store = await createStore();

    await expect(store.listEvents()).resolves.toEqual([]);
    await expect(store.listRecords()).resolves.toEqual([]);
  });

  it("appends immutable events and reads by memory id and fingerprint id", async () => {
    const store = await createStore();

    await store.appendEvent(event);

    expect(await store.listEvents()).toHaveLength(1);
    expect(await store.listEventsByMemoryId(event.memoryId)).toHaveLength(1);
    expect(
      await store.listEventsByFingerprintId(event.fingerprintId)
    ).toHaveLength(1);
  });

  it("writes projections without mutating the event log", async () => {
    const store = await createStore();

    await store.appendEvent(event);
    await store.writeProjection(record);

    expect(await store.listEvents()).toEqual([event]);
    expect(await store.getRecord(record.id)).toEqual(record);
    expect(await store.getRecordByFingerprintId(record.fingerprintId)).toEqual(
      record
    );
  });

  it("replaces projections without mutating the event log", async () => {
    const store = await createStore();
    const updatedRecord: EngineeringMemoryRecord = {
      ...record,
      occurrenceCount: 2,
      lastSeenAt: "2026-07-06T00:00:00.000Z"
    };

    await store.appendEvent(event);
    await store.writeProjection(record);
    await store.replaceProjections([updatedRecord]);

    expect(await store.listEvents()).toEqual([event]);
    expect(await store.listRecords()).toEqual([updatedRecord]);
  });
});
