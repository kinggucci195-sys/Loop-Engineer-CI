import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

export type WebhookDeliveryStatus =
  | "received"
  | "processed"
  | "ignored"
  | "failed";

export interface WebhookDeliveryRecord {
  version: 1;
  id: string;
  source: "github";
  sourceDeliveryId: string;
  eventName?: string;
  status: WebhookDeliveryStatus;
  reason?: string;
  receivedAt: string;
  updatedAt: string;
  latencyMs?: number;
}

export interface WebhookDeliverySummary {
  totalDeliveries: number;
  received: number;
  processed: number;
  ignored: number;
  failed: number;
  duplicateSuppressed: number;
  deadLetterCount: number;
  processedLatencyP95Ms: number | null;
  latestDeliveryAt?: string;
}

export interface BeginWebhookDeliveryResult {
  duplicate: boolean;
  record: WebhookDeliveryRecord;
}

export interface WebhookDeliveryStore {
  begin(input: {
    sourceDeliveryId: string;
    eventName?: string;
  }): Promise<BeginWebhookDeliveryResult>;
  markProcessed(
    sourceDeliveryId: string,
    input?: { reason?: string; latencyMs?: number }
  ): Promise<void>;
  markIgnored(
    sourceDeliveryId: string,
    input: { reason: string; latencyMs?: number }
  ): Promise<void>;
  markFailed(
    sourceDeliveryId: string,
    input: { reason: string; latencyMs?: number }
  ): Promise<void>;
  list(): Promise<WebhookDeliveryRecord[]>;
  summarize(): Promise<WebhookDeliverySummary>;
}

export function createJsonlWebhookDeliveryStore(options: {
  deliveriesPath: string;
  deadLetterPath: string;
}): WebhookDeliveryStore {
  async function append(
    path: string,
    record: WebhookDeliveryRecord
  ): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(record)}\n`, "utf8");
  }

  async function latestFor(
    sourceDeliveryId: string
  ): Promise<WebhookDeliveryRecord | undefined> {
    return latestByDeliveryId(await readJsonl(options.deliveriesPath)).get(
      sourceDeliveryId
    );
  }

  async function appendTransition(
    sourceDeliveryId: string,
    status: WebhookDeliveryStatus,
    input: {
      eventName?: string;
      reason?: string;
      latencyMs?: number;
    } = {}
  ): Promise<WebhookDeliveryRecord> {
    const previous = await latestFor(sourceDeliveryId);
    const now = new Date().toISOString();
    const eventName = input.eventName ?? previous?.eventName;
    const record: WebhookDeliveryRecord = {
      version: 1,
      id: createDeliveryRecordId(sourceDeliveryId, status, now),
      source: "github",
      sourceDeliveryId,
      ...(eventName ? { eventName } : {}),
      status,
      ...(input.reason ? { reason: input.reason } : {}),
      receivedAt: previous?.receivedAt ?? now,
      updatedAt: now,
      ...(typeof input.latencyMs === "number"
        ? { latencyMs: input.latencyMs }
        : {})
    };
    await append(options.deliveriesPath, record);
    return record;
  }

  return {
    begin: async (input) => {
      const previous = await latestFor(input.sourceDeliveryId);

      if (previous?.status === "processed" || previous?.status === "ignored") {
        const record = await appendTransition(
          input.sourceDeliveryId,
          previous.status,
          {
            ...(input.eventName ? { eventName: input.eventName } : {}),
            reason: "duplicate-delivery",
            latencyMs: 0
          }
        );

        return {
          duplicate: true,
          record
        };
      }

      const record = await appendTransition(
        input.sourceDeliveryId,
        "received",
        {
          ...(input.eventName ? { eventName: input.eventName } : {})
        }
      );

      return {
        duplicate: false,
        record
      };
    },

    markProcessed: async (sourceDeliveryId, input = {}) => {
      await appendTransition(sourceDeliveryId, "processed", input);
    },

    markIgnored: async (sourceDeliveryId, input) => {
      await appendTransition(sourceDeliveryId, "ignored", input);
    },

    markFailed: async (sourceDeliveryId, input) => {
      const record = await appendTransition(sourceDeliveryId, "failed", input);
      await append(options.deadLetterPath, record);
    },

    list: async () => readJsonl(options.deliveriesPath),

    summarize: async () => summarizeDeliveries(await readJsonl(options.deliveriesPath))
  };
}

export function summarizeDeliveries(
  records: WebhookDeliveryRecord[]
): WebhookDeliverySummary {
  const latest = latestByDeliveryId(records);
  const latestRecords = [...latest.values()];
  const latencies = records
    .filter(
      (record) =>
        record.status === "processed" && record.reason !== "duplicate-delivery"
    )
    .map((record) => record.latencyMs)
    .filter((value): value is number => typeof value === "number")
    .sort((left, right) => left - right);

  const latestDeliveryAt = latestRecords
    .map((record) => record.updatedAt)
    .sort()
    .at(-1);

  return {
    totalDeliveries: latestRecords.length,
    received: latestRecords.filter((record) => record.status === "received")
      .length,
    processed: latestRecords.filter((record) => record.status === "processed")
      .length,
    ignored: latestRecords.filter((record) => record.status === "ignored")
      .length,
    failed: latestRecords.filter((record) => record.status === "failed").length,
    duplicateSuppressed: records.filter(
      (record) => record.reason === "duplicate-delivery"
    ).length,
    deadLetterCount: records.filter((record) => record.status === "failed")
      .length,
    processedLatencyP95Ms: percentile(latencies, 0.95),
    ...(latestDeliveryAt ? { latestDeliveryAt } : {})
  };
}

export function createDeliveryIdFromPayload(input: {
  deliveryId: string | string[] | undefined;
  rawBody: string | Buffer | undefined;
}): string {
  const deliveryId = Array.isArray(input.deliveryId)
    ? input.deliveryId[0]
    : input.deliveryId;

  if (deliveryId) {
    return deliveryId;
  }

  return `body:${createHash("sha256")
    .update(input.rawBody ?? "")
    .digest("hex")
    .slice(0, 32)}`;
}

function latestByDeliveryId(
  records: WebhookDeliveryRecord[]
): Map<string, WebhookDeliveryRecord> {
  const latest = new Map<string, WebhookDeliveryRecord>();

  for (const record of records) {
    latest.set(record.sourceDeliveryId, record);
  }

  return latest;
}

async function readJsonl(path: string): Promise<WebhookDeliveryRecord[]> {
  try {
    const contents = await readFile(path, "utf8");
    return contents
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as WebhookDeliveryRecord);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function percentile(values: number[], quantile: number): number | null {
  if (values.length === 0) {
    return null;
  }

  const index = Math.ceil(values.length * quantile) - 1;
  return values[Math.max(0, Math.min(index, values.length - 1))] ?? null;
}

function createDeliveryRecordId(
  sourceDeliveryId: string,
  status: WebhookDeliveryStatus,
  timestamp: string
): string {
  return `webhook-${createHash("sha256")
    .update(`${sourceDeliveryId}:${status}:${timestamp}`)
    .digest("hex")
    .slice(0, 24)}`;
}
