import type {
  EngineeringMemoryEvent,
  EngineeringMemoryRecord,
  Fingerprint
} from "@loopci/contracts";
import type { MemoryStore } from "./memory-store";
import { rebuildProjectionFromEvents } from "./projection-builder";

type ProjectionFingerprint = Pick<Fingerprint, "id" | "type" | "version">;

export interface MemoryReplayFilter {
  fingerprintId?: string;
  fingerprintType?: Fingerprint["type"];
  repository?: string;
  occurredAtFrom?: string;
  occurredAtTo?: string;
}

export function rebuildMemoryProjections(
  events: EngineeringMemoryEvent[],
  filter: MemoryReplayFilter = {}
): EngineeringMemoryRecord[] {
  const grouped = new Map<string, EngineeringMemoryEvent[]>();

  for (const event of selectReplayEvents(events, filter)) {
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
      id: firstEvent.fingerprint.id,
      type: firstEvent.fingerprint.type,
      version: firstEvent.fingerprint.version
    };

    return rebuildProjectionFromEvents(fingerprint, group);
  });
}

export async function replayMemoryProjections(
  store: MemoryStore,
  filter: MemoryReplayFilter = {}
): Promise<EngineeringMemoryRecord[]> {
  const records = rebuildMemoryProjections(await store.listEvents(), filter);

  if (Object.keys(filter).length === 0) {
    await store.replaceProjections(records);
  } else if (isPersistentPartitionReplay(filter)) {
    for (const record of records) {
      await store.writeProjection(record);
    }
  }

  return records;
}

function selectReplayEvents(
  events: EngineeringMemoryEvent[],
  filter: MemoryReplayFilter
): EngineeringMemoryEvent[] {
  if (Object.keys(filter).length === 0) {
    return events;
  }

  if (filter.fingerprintId || filter.repository) {
    const affectedFingerprintIds = new Set(
      events
        .filter((event) => matchesReplayFilter(event, filter))
        .map((event) => event.fingerprintId)
    );

    return events.filter((event) =>
      affectedFingerprintIds.has(event.fingerprintId)
    );
  }

  return events.filter((event) => matchesReplayFilter(event, filter));
}

function matchesReplayFilter(
  event: EngineeringMemoryEvent,
  filter: MemoryReplayFilter
): boolean {
  if (filter.fingerprintId && event.fingerprintId !== filter.fingerprintId) {
    return false;
  }

  if (
    filter.fingerprintType &&
    event.fingerprintType !== filter.fingerprintType
  ) {
    return false;
  }

  if (
    filter.repository &&
    event.relationships.repository !== filter.repository
  ) {
    return false;
  }

  if (filter.occurredAtFrom && event.occurredAt < filter.occurredAtFrom) {
    return false;
  }

  if (filter.occurredAtTo && event.occurredAt > filter.occurredAtTo) {
    return false;
  }

  return true;
}

function isPersistentPartitionReplay(filter: MemoryReplayFilter): boolean {
  return Boolean(filter.fingerprintId || filter.repository);
}

export function isAnalysisOnlyReplay(filter: MemoryReplayFilter): boolean {
  return (
    Boolean(filter.occurredAtFrom || filter.occurredAtTo) &&
    !isPersistentPartitionReplay(filter)
  );
}

export function filterReplayEventsForAnalysis(
  events: EngineeringMemoryEvent[],
  filter: MemoryReplayFilter
): EngineeringMemoryEvent[] {
  return events.filter((event) => {
    return matchesReplayFilter(event, filter);
  });
}
