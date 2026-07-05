import type {
  EngineeringMemoryEvent,
  EngineeringMemoryRecord,
  Fingerprint
} from "@loopci/contracts";
import type { MemoryStore } from "./memory-store";
import { rebuildProjectionFromEvents } from "./projection-builder";

type ProjectionFingerprint = Pick<Fingerprint, "id" | "type" | "version">;

export function rebuildMemoryProjections(
  events: EngineeringMemoryEvent[]
): EngineeringMemoryRecord[] {
  const grouped = new Map<string, EngineeringMemoryEvent[]>();

  for (const event of events) {
    const groupKey = [
      event.fingerprintType,
      event.fingerprintVersion,
      event.fingerprintId
    ].join(":");
    const group = grouped.get(groupKey) ?? [];
    group.push(event);
    grouped.set(groupKey, group);
  }

  return [...grouped.values()].map((group) => {
    const firstEvent = group[0];

    if (!firstEvent) {
      throw new Error("Cannot rebuild an empty memory event group.");
    }

    const fingerprint: ProjectionFingerprint = {
      id: firstEvent.fingerprintId,
      type: firstEvent.fingerprintType,
      version: firstEvent.fingerprintVersion
    };

    return rebuildProjectionFromEvents(fingerprint, group);
  });
}

export async function replayMemoryProjections(
  store: MemoryStore
): Promise<EngineeringMemoryRecord[]> {
  const records = rebuildMemoryProjections(await store.listEvents());
  await store.replaceProjections(records);

  return records;
}
