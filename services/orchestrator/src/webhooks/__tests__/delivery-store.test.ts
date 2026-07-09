import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDeliveryIdFromPayload,
  createJsonlWebhookDeliveryStore
} from "../delivery-store";

describe("JsonlWebhookDeliveryStore", () => {
  it("tracks processed deliveries and suppresses repeated delivery ids", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-webhooks-"));
    const store = createJsonlWebhookDeliveryStore({
      deliveriesPath: join(dir, "webhook-deliveries.jsonl"),
      deadLetterPath: join(dir, "webhook-dead-letter.jsonl")
    });

    await expect(
      store.begin({ sourceDeliveryId: "delivery-1", eventName: "workflow_run" })
    ).resolves.toMatchObject({
      duplicate: false
    });
    await store.markProcessed("delivery-1", { latencyMs: 42 });

    await expect(
      store.begin({ sourceDeliveryId: "delivery-1", eventName: "workflow_run" })
    ).resolves.toMatchObject({
      duplicate: true,
      record: {
        reason: "duplicate-delivery"
      }
    });

    await expect(store.summarize()).resolves.toMatchObject({
      totalDeliveries: 1,
      processed: 1,
      duplicateSuppressed: 1,
      processedLatencyP95Ms: 42
    });
  });

  it("writes failed deliveries to the dead-letter summary", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-webhooks-"));
    const store = createJsonlWebhookDeliveryStore({
      deliveriesPath: join(dir, "webhook-deliveries.jsonl"),
      deadLetterPath: join(dir, "webhook-dead-letter.jsonl")
    });

    await store.begin({ sourceDeliveryId: "delivery-2" });
    await store.markFailed("delivery-2", {
      reason: "handler exploded",
      latencyMs: 100
    });

    await expect(store.summarize()).resolves.toMatchObject({
      totalDeliveries: 1,
      failed: 1,
      deadLetterCount: 1
    });
  });

  it("falls back to a stable payload hash when GitHub delivery id is missing", () => {
    expect(
      createDeliveryIdFromPayload({
        deliveryId: undefined,
        rawBody: "{\"ok\":true}"
      })
    ).toBe(
      createDeliveryIdFromPayload({
        deliveryId: undefined,
        rawBody: "{\"ok\":true}"
      })
    );
  });
});
