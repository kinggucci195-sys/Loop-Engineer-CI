import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import fastifyRawBody from "fastify-raw-body";
import { timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { ciFailureEventSchema } from "@loopci/contracts";
import type {
  CiFailureEvent,
  FailureClassification,
  RepairPlan,
  EngineeringRecognitionSummary
} from "@loopci/contracts";
import type { LoopCiEnv } from "@loopci/config";
import { createLogger } from "@loopci/logger";
import type { FailureClassifier } from "./ai/classifier";
import { createRepairPlan } from "./domain/repair-plan";
import { createFailureFingerprint } from "./memory/fingerprint";
import {
  createJsonlMemoryStore,
  type MemoryStore
} from "./memory/memory-store";
import {
  createFailureObservedEvent,
  createRepairRequestedEvent,
  rebuildProjectionFromEvents
} from "./memory/projection-builder";
import { recognizeEngineeringMemory } from "./memory/recognition-engine";
import {
  applyLogLimit,
  createFileRepositoryPolicyProvider,
  enforceRepositoryPolicy,
  isBranchAllowed,
  type RepositoryPolicyProvider
} from "./policy/repository-policy";
import {
  createNotificationDispatcher,
  type NotificationDispatcher
} from "./notifications/dispatcher";
import { getNotificationIntegrationStatus } from "./notifications/notification-status";
import {
  createOwnershipResolver,
  type OwnershipResolution,
  type OwnershipResolver
} from "./ownership/ownership-resolver";
import { verifyGitHubWebhookSignature } from "./security/github-signature";
import type { PlanStore } from "./state/plan-store";
import {
  createDeliveryIdFromPayload,
  createJsonlWebhookDeliveryStore,
  type WebhookDeliveryStore
} from "./webhooks/delivery-store";
import { createCiFailureEventFromGitHubWebhook } from "./webhooks/github";

export interface ServerDependencies {
  env: LoopCiEnv;
  classifier: FailureClassifier;
  planStore: PlanStore;
  policyProvider?: RepositoryPolicyProvider;
  notificationDispatcher?: NotificationDispatcher;
  memoryStore?: MemoryStore;
  ownershipResolver?: OwnershipResolver;
  webhookDeliveryStore?: WebhookDeliveryStore;
}

export function buildServer(dependencies: ServerDependencies) {
  const logger = createLogger();
  const server = Fastify({ logger: false });
  const policyProvider =
    dependencies.policyProvider ??
    createFileRepositoryPolicyProvider(dependencies.env.LOOPCI_POLICY_PATH);
  const notificationDispatcher =
    dependencies.notificationDispatcher ??
    createNotificationDispatcher(dependencies.env, logger);
  const memoryStore =
    dependencies.memoryStore ??
    createJsonlMemoryStore({
      eventsPath: resolve(dependencies.env.STATE_DIR, "memory-events.jsonl"),
      recordsPath: resolve(dependencies.env.STATE_DIR, "memory.jsonl")
    });
  const ownershipResolver =
    dependencies.ownershipResolver ??
    createOwnershipResolver({
      codeownersPath: dependencies.env.LOOPCI_CODEOWNERS_PATH
    });
  const webhookDeliveryStore =
    dependencies.webhookDeliveryStore ??
    createJsonlWebhookDeliveryStore({
      deliveriesPath: resolve(
        dependencies.env.STATE_DIR,
        "webhook-deliveries.jsonl"
      ),
      deadLetterPath: resolve(
        dependencies.env.STATE_DIR,
        "webhook-dead-letter.jsonl"
      )
    });

  server.register(fastifyRawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true
  });

  server.after((error) => {
    if (error) {
      throw error;
    }

    server.get("/health", async () => ({
      ok: true,
      service: "loopci-orchestrator"
    }));

    server.get("/ready", async (_request, reply) => {
      try {
        const plans = await dependencies.planStore.list();

        return {
          ok: true,
          service: "loopci-orchestrator",
          planCount: plans.length
        };
      } catch (error) {
        logger.error({ error }, "LoopCI orchestrator readiness check failed");

        return reply.code(503).send({
          ok: false,
          service: "loopci-orchestrator",
          reason: "plan-store-unavailable"
        });
      }
    });

    server.get("/plans", async (request, reply) => {
      if (!authorizeInternalRequest(request, reply)) {
        return reply;
      }

      return {
      plans: await dependencies.planStore.list()
      };
    });

    server.get("/integrations/status", async (request, reply) => {
      if (!authorizeInternalRequest(request, reply)) {
        return reply;
      }

      return getNotificationIntegrationStatus(dependencies.env);
    });

    server.get("/operations/metrics", async (request, reply) => {
      if (!authorizeInternalRequest(request, reply)) {
        return reply;
      }

      const [plans, memoryRecords, webhookDeliveries] = await Promise.all([
        dependencies.planStore.list(),
        memoryStore.listRecords(),
        webhookDeliveryStore.summarize()
      ]);

      return {
        service: "loopci-orchestrator",
        generatedAt: new Date().toISOString(),
        sloTargets: {
          webhookSuccessRate: ">= 99%",
          processingLatencyP95Ms: "<= 2000",
          deadLetterRate: "<= 0.3%"
        },
        webhooks: webhookDeliveries,
        plans: {
          total: plans.length,
          open: plans.filter((plan) => plan.status !== "closed").length,
          blocked: plans.filter((plan) => plan.status === "blocked").length,
          queued: plans.filter((plan) => plan.status === "queued").length
        },
        memory: {
          records: memoryRecords.length,
          recurring: memoryRecords.filter(
            (record) => record.occurrenceCount >= 3
          ).length
        }
      };
    });

    server.get("/memory", async (request, reply) => {
      if (!authorizeInternalRequest(request, reply)) {
        return reply;
      }

      const records = await memoryStore.listRecords();
      const recordsWithRecognition = await Promise.all(
        records.map(async (record) => {
          const events = await memoryStore.listEventsByMemoryId(record.id);

          return {
            record,
            recognition: recognizeEngineeringMemory(record, events)
          };
        })
      );

      return {
        records: recordsWithRecognition
      };
    });

    server.get("/memory/:id", async (request, reply) => {
      if (!authorizeInternalRequest(request, reply)) {
        return reply;
      }

      const { id } = request.params as { id: string };
      const record = await memoryStore.getRecord(id);

      if (!record) {
        return reply.code(404).send({
          found: false,
          reason: "memory-not-found",
          id
        });
      }

      const events = await memoryStore.listEventsByMemoryId(record.id);

      return {
        found: true,
        record,
        events,
        recognition: recognizeEngineeringMemory(record, events)
      };
    });

    server.get("/plans/:planId", async (request, reply) => {
      if (!authorizeInternalRequest(request, reply)) {
        return reply;
      }

      const { planId } = request.params as { planId: string };
      const plan = await findPlan(planId);

      if (!plan) {
        return reply.code(404).send({
          found: false,
          reason: "plan-not-found",
          planId
        });
      }

      return {
        found: true,
        plan
      };
    });

    server.get("/actions/plans/:planId/request-fix", async (request, reply) => {
      const { planId } = request.params as { planId: string };
      const plan = await findPlan(planId);

      if (!plan) {
        return reply
          .code(404)
          .type("text/html")
          .send(
            renderActionPage({
              title: "Plan not found",
              body: `LoopCI could not find repair plan ${escapeHtml(planId)}.`
            })
          );
      }

      return reply.type("text/html").send(
        renderActionPage({
          title: "Request LoopCI Fix",
          body: [
            `<p><strong>${escapeHtml(plan.event.repository)}</strong></p>`,
            `<p>${escapeHtml(plan.classification.summary)}</p>`,
            `<form method="post" action="/actions/plans/${encodeURIComponent(
              plan.id
            )}/request-fix">`,
            `<button type="submit">Request draft repair PR</button>`,
            `</form>`
          ].join("")
        })
      );
    });

    server.post(
      "/actions/plans/:planId/request-fix",
      async (request, reply) => {
        const { planId } = request.params as { planId: string };
        const plan = await findPlan(planId);

        if (!plan) {
          return reply.code(404).send({
            accepted: false,
            reason: "plan-not-found",
            planId
          });
        }

        if (plan.classification.risk !== "low") {
          return reply.code(409).send({
            accepted: false,
            reason: "human-review-required",
            planId,
            risk: plan.classification.risk
          });
        }

        const requestedPlan = {
          ...plan,
          status: "queued" as const
        };
        await dependencies.planStore.update(requestedPlan);
        await recordRepairRequested(requestedPlan);

        return reply.code(202).send({
          accepted: true,
          plan: requestedPlan,
          next: "queued-for-worker-evidence"
        });
      }
    );

    server.post("/events/github-actions/failure", async (request, reply) => {
      if (!allowUnsignedFailureEndpoint(request)) {
        return reply.code(404).send({
          accepted: false,
          reason: "unsigned-event-endpoint-disabled"
        });
      }

      const event = ciFailureEventSchema.parse({
        ...(request.body as Record<string, unknown>),
        receivedAt: new Date().toISOString()
      });

      return acceptFailureEvent(event, reply);
    });

    server.post(
      "/webhooks/github",
      { config: { rawBody: true } },
      async (request, reply) => {
        const webhookStart = performance.now();
        const deliveryId = createDeliveryIdFromPayload({
          deliveryId: request.headers["x-github-delivery"],
          rawBody: request.rawBody
        });
        const eventName = headerValue(request.headers["x-github-event"]);
        const signatureValid = verifyGitHubWebhookSignature(
          request.rawBody,
          request.headers["x-hub-signature-256"],
          dependencies.env.GITHUB_WEBHOOK_SECRET
        );

        if (!signatureValid) {
          return reply.code(401).send({
            accepted: false,
            reason: "invalid-github-signature"
          });
        }

        const delivery = await webhookDeliveryStore.begin({
          sourceDeliveryId: deliveryId,
          ...(eventName ? { eventName } : {})
        });

        if (delivery.duplicate) {
          return reply.code(202).send({
            accepted: false,
            reason: "duplicate-github-delivery",
            deliveryId
          });
        }

        try {
          const event = createCiFailureEventFromGitHubWebhook(
            request.headers["x-github-event"],
            request.body
          );

          if (!event) {
            await webhookDeliveryStore.markIgnored(deliveryId, {
              reason: "ignored-github-event",
              latencyMs: durationSince(webhookStart)
            });

            return reply.code(202).send({
              accepted: false,
              reason: "ignored-github-event",
              deliveryId
            });
          }

          return acceptFailureEvent(event, reply, async () => {
            await webhookDeliveryStore.markProcessed(deliveryId, {
              latencyMs: durationSince(webhookStart)
            });
          });
        } catch (error) {
          await webhookDeliveryStore.markFailed(deliveryId, {
            reason: error instanceof Error ? error.message : "unknown-error",
            latencyMs: durationSince(webhookStart)
          });
          throw error;
        }
      }
    );
  });

  async function acceptFailureEvent(
    event: CiFailureEvent,
    reply: FastifyReply,
    beforeSend?: () => Promise<void>
  ) {
    const timingsMs: Record<string, number> = {};
    const totalStart = performance.now();
    const policyStart = performance.now();
    const policy = await policyProvider.getPolicy(event.repository);
    timingsMs.policy = durationSince(policyStart);

    if (!policy.enabled) {
      return reply.code(202).send({
        accepted: false,
        reason: "repository-disabled",
        repository: event.repository
      });
    }

    if (!isBranchAllowed(policy, event.branch)) {
      return reply.code(202).send({
        accepted: false,
        reason: "branch-not-allowed",
        repository: event.repository,
        branch: event.branch
      });
    }

    const policyEvent = applyLogLimit(
      ciFailureEventSchema.parse({
        ...event,
        receivedAt: new Date().toISOString()
      }),
      policy
    );
    const classificationStart = performance.now();
    const initialClassification =
      await dependencies.classifier.classify(policyEvent);
    const classification = enforceRepositoryPolicy(
      policyEvent,
      initialClassification,
      policy
    );
    timingsMs.classification = durationSince(classificationStart);
    const ownership = await ownershipResolver.resolve(
      policyEvent,
      classification
    );
    let plan = createRepairPlan(policyEvent, classification, ownership);
    const memoryStart = performance.now();
    const memoryResult = await recordEngineeringMemory(
      policyEvent,
      classification,
      plan,
      ownership
    );
    timingsMs.memory = durationSince(memoryStart);
    const recognition = memoryResult?.recognition ?? null;

    if (memoryResult) {
      plan = {
        ...plan,
        memoryRecordId: memoryResult.memoryRecordId
      };
    }

    const planStoreStart = performance.now();
    await dependencies.planStore.append(plan);
    timingsMs.planStore = durationSince(planStoreStart);
    const notificationsStart = performance.now();
    await notificationDispatcher.notifyRepairPlan(plan);
    timingsMs.notifications = durationSince(notificationsStart);
    timingsMs.total = durationSince(totalStart);

    logger.info(
      {
        planId: plan.id,
        repository: policyEvent.repository,
        kind: classification.kind,
        risk: classification.risk,
        ownership,
        recognition,
        timingsMs
      },
      "Created repair plan"
    );

    await beforeSend?.();

    return reply.code(202).send({
      accepted: true,
      plan,
      policy: {
        autoCreateIssue: policy.autoCreateIssue,
        autoCommentOnPr: policy.autoCommentOnPr,
        humanReviewRequired: classification.requiresHuman
      },
      recognition,
      timingsMs
    });
  }

  async function recordEngineeringMemory(
    event: CiFailureEvent,
    classification: FailureClassification,
    plan: RepairPlan,
    ownership: OwnershipResolution
  ): Promise<{
    memoryRecordId: string;
    recognition: EngineeringRecognitionSummary;
  } | null> {
    if (!dependencies.env.LOOPCI_MEMORY_ENABLED) {
      return null;
    }

    const fingerprint = createFailureFingerprint(event, classification);
    const failureObservedEvent = createFailureObservedEvent(
      plan,
      fingerprint,
      ownership
    );
    await memoryStore.appendEvent(failureObservedEvent);
    const events = await memoryStore.listEventsByFingerprintId(fingerprint.id);

    const projection = rebuildProjectionFromEvents(fingerprint, events);
    await memoryStore.writeProjection(projection);

    const recognition = recognizeEngineeringMemory(projection, events);
    return {
      memoryRecordId: projection.id,
      recognition
    };
  }

  async function recordRepairRequested(plan: RepairPlan): Promise<void> {
    if (!dependencies.env.LOOPCI_MEMORY_ENABLED || !plan.memoryRecordId) {
      return;
    }

    const events = await memoryStore.listEventsByMemoryId(plan.memoryRecordId);
    const sourceEvent = events.find(
      (event) => event.type === "failure-observed"
    );

    if (!sourceEvent) {
      return;
    }

    const repairRequestedEvent = createRepairRequestedEvent(plan, sourceEvent);
    await memoryStore.appendEvent(repairRequestedEvent);
    const updatedEvents = await memoryStore.listEventsByMemoryId(
      plan.memoryRecordId
    );
    const projection = rebuildProjectionFromEvents(
      sourceEvent.fingerprint,
      updatedEvents
    );
    await memoryStore.writeProjection(projection);
  }

  async function findPlan(planId: string) {
    const plans = await dependencies.planStore.list();
    return plans.find((plan) => plan.id === planId);
  }

  return server;

  function authorizeInternalRequest(
    request: FastifyRequest,
    reply: FastifyReply
  ): boolean {
    if (!dependencies.env.LOOPCI_API_TOKEN) {
      return true;
    }

    if (hasValidApiToken(request.headers.authorization)) {
      return true;
    }

    reply.code(401).send({
      ok: false,
      reason: "unauthorized"
    });
    return false;
  }

  function allowUnsignedFailureEndpoint(request: FastifyRequest): boolean {
    return (
      dependencies.env.NODE_ENV !== "production" ||
      dependencies.env.LOOPCI_ALLOW_UNSIGNED_EVENTS ||
      hasValidApiToken(request.headers.authorization)
    );
  }

  function hasValidApiToken(authorization: unknown): boolean {
    const expected = dependencies.env.LOOPCI_API_TOKEN;

    if (!expected || typeof authorization !== "string") {
      return false;
    }

    const prefix = "Bearer ";
    if (!authorization.startsWith(prefix)) {
      return false;
    }

    const provided = authorization.slice(prefix.length);
    const expectedBuffer = Buffer.from(expected, "utf8");
    const providedBuffer = Buffer.from(provided, "utf8");

    return (
      expectedBuffer.length === providedBuffer.length &&
      timingSafeEqual(expectedBuffer, providedBuffer)
    );
  }
}

function durationSince(start: number): number {
  return Math.round((performance.now() - start) * 100) / 100;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function renderActionPage(input: { title: string; body: string }) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(input.title)}</title>`,
    "</head>",
    "<body>",
    `<main>${input.body}</main>`,
    "</body>",
    "</html>"
  ].join("");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
