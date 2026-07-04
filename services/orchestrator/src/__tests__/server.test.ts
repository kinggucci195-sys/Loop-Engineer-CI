import { buildServer } from "../server";
import { createJsonlPlanStore } from "../state/plan-store";
import { createHeuristicClassifier } from "../ai/classifier";
import { loadEnv } from "@loopci/config";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { signGitHubWebhookBody } from "../security/github-signature";

describe("orchestrator server", () => {
  it("creates a repair plan from a failed GitHub Actions event", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const server = buildServer({
      env: loadEnv({ NODE_ENV: "test" }),
      classifier: createHeuristicClassifier(),
      planStore: createJsonlPlanStore(join(dir, "plans.jsonl")),
      notificationDispatcher: {
        notifyRepairPlan: jest.fn()
      }
    });

    const response = await server.inject({
      method: "POST",
      url: "/events/github-actions/failure",
      payload: {
        provider: "github-actions",
        repository: "kinggucci195-sys/loopci",
        workflow: "ci",
        runId: "1001",
        runUrl: "https://github.com/kinggucci195-sys/loopci/actions/runs/1001",
        commitSha: "abcdef1",
        branch: "main",
        failedJob: "validate",
        failedStep: "npm run lint",
        logExcerpt: "ESLint no-console violation in src/index.ts"
      }
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().plan.classification.kind).toBe("lint");
  });

  it("reports readiness when the plan store is available", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const server = buildServer({
      env: loadEnv({ NODE_ENV: "test" }),
      classifier: createHeuristicClassifier(),
      planStore: createJsonlPlanStore(join(dir, "plans.jsonl"))
    });

    const response = await server.inject({
      method: "GET",
      url: "/ready"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      service: "loopci-orchestrator",
      planCount: 0
    });
  });

  it("accepts signed GitHub workflow_run failure webhooks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const secret = "test-secret";
    const notifyRepairPlan = jest.fn();
    const server = buildServer({
      env: loadEnv({ NODE_ENV: "test", GITHUB_WEBHOOK_SECRET: secret }),
      classifier: createHeuristicClassifier(),
      planStore: createJsonlPlanStore(join(dir, "plans.jsonl")),
      notificationDispatcher: {
        notifyRepairPlan
      }
    });
    const payload = JSON.stringify({
      action: "completed",
      sender: {
        login: "kinggucci195-sys"
      },
      repository: {
        full_name: "kinggucci195-sys/loopci"
      },
      workflow_run: {
        id: 2002,
        name: "CI",
        html_url:
          "https://github.com/kinggucci195-sys/loopci/actions/runs/2002",
        head_sha: "abcdef2",
        head_branch: "main",
        head_commit: {
          author: {
            name: "King Gucci",
            email: "dev@example.com"
          }
        },
        actor: {
          login: "kinggucci195-sys"
        },
        triggering_actor: {
          login: "kinggucci195-sys"
        },
        conclusion: "failure",
        status: "completed",
        event: "push"
      }
    });

    const response = await server.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "content-type": "application/json",
        "x-github-event": "workflow_run",
        "x-hub-signature-256": signGitHubWebhookBody(payload, secret)
      },
      payload
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({
      accepted: true,
      plan: {
        event: {
          repository: "kinggucci195-sys/loopci",
          runId: "2002",
          actor: "kinggucci195-sys",
          triggeringActor: "kinggucci195-sys",
          commitAuthorEmail: "dev@example.com"
        }
      }
    });
    expect(notifyRepairPlan).toHaveBeenCalledTimes(1);
  });

  it("queues a low-risk fix request from an action endpoint", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const server = buildServer({
      env: loadEnv({ NODE_ENV: "test" }),
      classifier: createHeuristicClassifier(),
      planStore: createJsonlPlanStore(join(dir, "plans.jsonl")),
      notificationDispatcher: {
        notifyRepairPlan: jest.fn()
      }
    });

    const createResponse = await server.inject({
      method: "POST",
      url: "/events/github-actions/failure",
      payload: {
        provider: "github-actions",
        repository: "kinggucci195-sys/loopci",
        workflow: "ci",
        runId: "3003",
        runUrl: "https://github.com/kinggucci195-sys/loopci/actions/runs/3003",
        commitSha: "abcdef3",
        branch: "main",
        actor: "kinggucci195-sys",
        failedJob: "validate",
        failedStep: "npm run lint",
        logExcerpt: "ESLint no-console violation in src/index.ts"
      }
    });
    const planId = createResponse.json().plan.id;

    const actionResponse = await server.inject({
      method: "POST",
      url: `/actions/plans/${encodeURIComponent(planId)}/request-fix`
    });

    expect(actionResponse.statusCode).toBe(202);
    expect(actionResponse.json()).toMatchObject({
      accepted: true,
      next: "queued-for-worker-evidence"
    });
  });

  it("rejects unsigned GitHub webhooks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const server = buildServer({
      env: loadEnv({ NODE_ENV: "test", GITHUB_WEBHOOK_SECRET: "test-secret" }),
      classifier: createHeuristicClassifier(),
      planStore: createJsonlPlanStore(join(dir, "plans.jsonl"))
    });

    const response = await server.inject({
      method: "POST",
      url: "/webhooks/github",
      payload: {
        action: "completed"
      }
    });

    expect(response.statusCode).toBe(401);
  });
});
