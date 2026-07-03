import Fastify from "fastify";
import { ciFailureEventSchema } from "@loopci/contracts";
import type { LoopCiEnv } from "@loopci/config";
import { createLogger } from "@loopci/logger";
import type { FailureClassifier } from "./ai/classifier";
import { createRepairPlan } from "./domain/repair-plan";
import type { PlanStore } from "./state/plan-store";

export interface ServerDependencies {
  env: LoopCiEnv;
  classifier: FailureClassifier;
  planStore: PlanStore;
}

export function buildServer(dependencies: ServerDependencies) {
  const logger = createLogger();
  const server = Fastify({ logger: false });

  server.get("/health", async () => ({
    ok: true,
    service: "loopci-orchestrator"
  }));

  server.get("/plans", async () => ({
    plans: await dependencies.planStore.list()
  }));

  server.post("/events/github-actions/failure", async (request, reply) => {
    const event = ciFailureEventSchema.parse({
      ...(request.body as Record<string, unknown>),
      receivedAt: new Date().toISOString()
    });
    const classification = await dependencies.classifier.classify(event);
    const plan = createRepairPlan(event, classification);

    await dependencies.planStore.append(plan);

    logger.info(
      {
        planId: plan.id,
        repository: event.repository,
        kind: classification.kind,
        risk: classification.risk
      },
      "Created repair plan"
    );

    return reply.code(202).send({ plan });
  });

  return server;
}
