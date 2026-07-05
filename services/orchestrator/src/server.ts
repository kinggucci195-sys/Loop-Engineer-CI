import Fastify from "fastify";
import type { FastifyReply } from "fastify";
import fastifyRawBody from "fastify-raw-body";
import { resolve } from "node:path";
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
  createRecognitionGeneratedEvent,
  updateProjectionWithEvent
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
import { verifyGitHubWebhookSignature } from "./security/github-signature";
import type { PlanStore } from "./state/plan-store";
import { createCiFailureEventFromGitHubWebhook } from "./webhooks/github";

export interface ServerDependencies {
  env: LoopCiEnv;
  classifier: FailureClassifier;
  planStore: PlanStore;
  policyProvider?: RepositoryPolicyProvider;
  notificationDispatcher?: NotificationDispatcher;
  memoryStore?: MemoryStore;
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

    server.get("/plans", async () => ({
      plans: await dependencies.planStore.list()
    }));

    server.get("/memory", async () => {
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

        return reply.code(202).send({
          accepted: true,
          plan: requestedPlan,
          next: "queued-for-worker-evidence"
        });
      }
    );

    server.post("/events/github-actions/failure", async (request, reply) => {
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

        const event = createCiFailureEventFromGitHubWebhook(
          request.headers["x-github-event"],
          request.body
        );

        if (!event) {
          return reply.code(202).send({
            accepted: false,
            reason: "ignored-github-event"
          });
        }

        return acceptFailureEvent(event, reply);
      }
    );
  });

  async function acceptFailureEvent(
    event: CiFailureEvent,
    reply: FastifyReply
  ) {
    const policy = await policyProvider.getPolicy(event.repository);

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
    const initialClassification =
      await dependencies.classifier.classify(policyEvent);
    const classification = enforceRepositoryPolicy(
      policyEvent,
      initialClassification,
      policy
    );
    const plan = createRepairPlan(policyEvent, classification);
    const recognition = await recordEngineeringMemory(
      policyEvent,
      classification,
      plan
    );

    await dependencies.planStore.append(plan);
    await notificationDispatcher.notifyRepairPlan(plan);

    logger.info(
      {
        planId: plan.id,
        repository: policyEvent.repository,
        kind: classification.kind,
        risk: classification.risk,
        recognition
      },
      "Created repair plan"
    );

    return reply.code(202).send({
      accepted: true,
      plan,
      policy: {
        autoCreateIssue: policy.autoCreateIssue,
        autoCommentOnPr: policy.autoCommentOnPr,
        humanReviewRequired: classification.requiresHuman
      },
      recognition
    });
  }

  async function recordEngineeringMemory(
    event: CiFailureEvent,
    classification: FailureClassification,
    plan: RepairPlan
  ): Promise<EngineeringRecognitionSummary | null> {
    if (!dependencies.env.LOOPCI_MEMORY_ENABLED) {
      return null;
    }

    const fingerprint = createFailureFingerprint(event, classification);
    const failureObservedEvent = createFailureObservedEvent(plan, fingerprint);
    const existingEvents = await memoryStore.listEventsByFingerprintId(
      fingerprint.id
    );

    await memoryStore.appendEvent(failureObservedEvent);

    const projection = updateProjectionWithEvent(
      fingerprint,
      existingEvents,
      failureObservedEvent
    );
    await memoryStore.writeProjection(projection);

    const recognition = recognizeEngineeringMemory(projection, [
      ...existingEvents,
      failureObservedEvent
    ]);
    await memoryStore.appendEvent(
      createRecognitionGeneratedEvent(plan, fingerprint, recognition.confidence)
    );

    return recognition;
  }

  async function findPlan(planId: string) {
    const plans = await dependencies.planStore.list();
    return plans.find((plan) => plan.id === planId);
  }

  return server;
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
