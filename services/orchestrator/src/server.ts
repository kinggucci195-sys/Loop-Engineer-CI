import Fastify from "fastify";
import type { FastifyReply } from "fastify";
import fastifyRawBody from "fastify-raw-body";
import { ciFailureEventSchema } from "@loopci/contracts";
import type { CiFailureEvent } from "@loopci/contracts";
import type { LoopCiEnv } from "@loopci/config";
import { createLogger } from "@loopci/logger";
import type { FailureClassifier } from "./ai/classifier";
import { createRepairPlan } from "./domain/repair-plan";
import {
  applyLogLimit,
  createFileRepositoryPolicyProvider,
  enforceRepositoryPolicy,
  isBranchAllowed,
  type RepositoryPolicyProvider
} from "./policy/repository-policy";
import { verifyGitHubWebhookSignature } from "./security/github-signature";
import type { PlanStore } from "./state/plan-store";
import { createCiFailureEventFromGitHubWebhook } from "./webhooks/github";

export interface ServerDependencies {
  env: LoopCiEnv;
  classifier: FailureClassifier;
  planStore: PlanStore;
  policyProvider?: RepositoryPolicyProvider;
}

export function buildServer(dependencies: ServerDependencies) {
  const logger = createLogger();
  const server = Fastify({ logger: false });
  const policyProvider =
    dependencies.policyProvider ??
    createFileRepositoryPolicyProvider(dependencies.env.LOOPCI_POLICY_PATH);

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

    await dependencies.planStore.append(plan);

    logger.info(
      {
        planId: plan.id,
        repository: policyEvent.repository,
        kind: classification.kind,
        risk: classification.risk
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
      }
    });
  }

  return server;
}
