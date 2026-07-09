import { buildServer } from "../server";
import { createJsonlPlanStore } from "../state/plan-store";
import { createHeuristicClassifier } from "../ai/classifier";
import { loadEnv } from "@loopci/config";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { signGitHubWebhookBody } from "../security/github-signature";
import { createJsonlMemoryStore } from "../memory/memory-store";

function createFailurePayload(runId = "1001") {
  return {
    provider: "github-actions",
    repository: "kinggucci195-sys/loopci",
    workflow: "ci",
    runId,
    runUrl: `https://github.com/kinggucci195-sys/loopci/actions/runs/${runId}`,
    commitSha: "abcdef1",
    branch: "main",
    actor: "kinggucci195-sys",
    failedJob: "validate",
    failedStep: "npm run lint",
    logExcerpt: "ESLint no-console violation in src/index.ts"
  };
}

function createMemoryStore(dir: string) {
  return createJsonlMemoryStore({
    eventsPath: join(dir, "memory-events.jsonl"),
    recordsPath: join(dir, "memory.jsonl")
  });
}

describe("orchestrator server", () => {
  it("creates a repair plan from a failed GitHub Actions event", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const memoryStore = createMemoryStore(dir);
    const server = buildServer({
      env: loadEnv({ NODE_ENV: "test", STATE_DIR: dir }),
      classifier: createHeuristicClassifier(),
      planStore: createJsonlPlanStore(join(dir, "plans.jsonl")),
      memoryStore,
      notificationDispatcher: {
        notifyRepairPlan: jest.fn()
      }
    });

    const response = await server.inject({
      method: "POST",
      url: "/events/github-actions/failure",
      payload: createFailurePayload()
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().plan.classification.kind).toBe("lint");
    expect(response.json().recognition).toMatchObject({
      seenBefore: false,
      recurring: false,
      recognitionType: "exact-fingerprint",
      occurrenceCount: 1
    });
    expect(response.json().timingsMs).toEqual(
      expect.objectContaining({
        policy: expect.any(Number),
        classification: expect.any(Number),
        memory: expect.any(Number),
        planStore: expect.any(Number),
        notifications: expect.any(Number),
        total: expect.any(Number)
      })
    );
    expect(response.json().plan.memoryRecordId).toBeDefined();
    expect(await memoryStore.listEvents()).toHaveLength(1);
    expect(await memoryStore.listRecords()).toHaveLength(1);
    expect((await memoryStore.listEvents()).map((event) => event.type)).toEqual(
      ["failure-observed"]
    );
    expect(await memoryStore.listEvents()).toEqual([
      expect.objectContaining({
        correlationId: "ci-run:github-actions:kinggucci195-sys/loopci:ci:1001",
        idempotencyKey: expect.stringContaining(
          "failure-observed:github-actions:kinggucci195-sys/loopci:ci:1001:abcdef1:validate:npm run lint:"
        ),
        source: "github-actions",
        sourceEventId: "1001",
        fingerprintVersion: 1,
        actor: "kinggucci195-sys"
      })
    ]);
  });

  it("does not duplicate memory events when the same CI failure is retried", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const memoryStore = createMemoryStore(dir);
    const server = buildServer({
      env: loadEnv({ NODE_ENV: "test", STATE_DIR: dir }),
      classifier: createHeuristicClassifier(),
      planStore: createJsonlPlanStore(join(dir, "plans.jsonl")),
      memoryStore,
      notificationDispatcher: {
        notifyRepairPlan: jest.fn()
      }
    });

    await server.inject({
      method: "POST",
      url: "/events/github-actions/failure",
      payload: createFailurePayload("1101")
    });
    await server.inject({
      method: "POST",
      url: "/events/github-actions/failure",
      payload: createFailurePayload("1101")
    });

    expect(await memoryStore.listEvents()).toHaveLength(1);
    expect(await memoryStore.listRecords()).toEqual([
      expect.objectContaining({
        occurrenceCount: 1
      })
    ]);
  });

  it("reports readiness when the plan store is available", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const server = buildServer({
      env: loadEnv({ NODE_ENV: "test", STATE_DIR: dir }),
      classifier: createHeuristicClassifier(),
      planStore: createJsonlPlanStore(join(dir, "plans.jsonl")),
      memoryStore: createMemoryStore(dir)
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

  it("returns redacted notification integration status", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const routingPath = join(dir, "loopci.notifications.json");
    await writeFile(
      routingPath,
      JSON.stringify({
        users: {
          "kinggucci195-sys": {
            teamsWebhookUrl: "https://teams.example.com/developer"
          }
        }
      }),
      "utf8"
    );
    const server = buildServer({
      env: loadEnv({
        NODE_ENV: "test",
        STATE_DIR: dir,
        LOOPCI_NOTIFICATION_USERS_PATH: routingPath,
        LOOPCI_JIRA_CREATE_ISSUES: "true",
        LOOPCI_JIRA_BASE_URL: "https://example.atlassian.net",
        LOOPCI_JIRA_EMAIL: "loopci@example.com",
        LOOPCI_JIRA_API_TOKEN: "secret-token",
        LOOPCI_JIRA_PROJECT_KEY: "ENG"
      }),
      classifier: createHeuristicClassifier(),
      planStore: createJsonlPlanStore(join(dir, "plans.jsonl")),
      memoryStore: createMemoryStore(dir)
    });

    const response = await server.inject({
      method: "GET",
      url: "/integrations/status"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      notificationsEnabled: true,
      routingConfigLoaded: true,
      usersConfigured: 1,
      channels: {
        teams: {
          configured: true,
          source: "per-user",
          userRoutes: 1
        },
        jira: {
          configured: true,
          createIssues: true,
          projectKeyConfigured: true
        }
      }
    });
    expect(response.body).not.toContain("secret-token");
    expect(response.body).not.toContain("teams.example.com");
  });

  it("protects internal read endpoints when an API token is configured", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const server = buildServer({
      env: loadEnv({
        NODE_ENV: "test",
        STATE_DIR: dir,
        LOOPCI_API_TOKEN: "super-secret-token"
      }),
      classifier: createHeuristicClassifier(),
      planStore: createJsonlPlanStore(join(dir, "plans.jsonl")),
      memoryStore: createMemoryStore(dir)
    });

    const unauthorized = await server.inject({
      method: "GET",
      url: "/plans"
    });
    const authorized = await server.inject({
      method: "GET",
      url: "/plans",
      headers: {
        authorization: "Bearer super-secret-token"
      }
    });

    expect(unauthorized.statusCode).toBe(401);
    expect(authorized.statusCode).toBe(200);
    expect(authorized.json()).toEqual({ plans: [] });
  });

  it("disables unsigned failure ingestion in production unless authorized", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const server = buildServer({
      env: loadEnv({
        NODE_ENV: "production",
        STATE_DIR: dir,
        LOOPCI_API_TOKEN: "super-secret-token"
      }),
      classifier: createHeuristicClassifier(),
      planStore: createJsonlPlanStore(join(dir, "plans.jsonl")),
      memoryStore: createMemoryStore(dir),
      notificationDispatcher: {
        notifyRepairPlan: jest.fn()
      }
    });

    const unsigned = await server.inject({
      method: "POST",
      url: "/events/github-actions/failure",
      payload: createFailurePayload("unsigned-prod")
    });
    const authorized = await server.inject({
      method: "POST",
      url: "/events/github-actions/failure",
      headers: {
        authorization: "Bearer super-secret-token"
      },
      payload: createFailurePayload("authorized-prod")
    });

    expect(unsigned.statusCode).toBe(404);
    expect(unsigned.json()).toMatchObject({
      reason: "unsigned-event-endpoint-disabled"
    });
    expect(authorized.statusCode).toBe(202);
  });

  it("accepts signed GitHub workflow_run failure webhooks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const secret = "test-secret";
    const notifyRepairPlan = jest.fn();
    const server = buildServer({
      env: loadEnv({
        NODE_ENV: "test",
        GITHUB_WEBHOOK_SECRET: secret,
        STATE_DIR: dir
      }),
      classifier: createHeuristicClassifier(),
      planStore: createJsonlPlanStore(join(dir, "plans.jsonl")),
      memoryStore: createMemoryStore(dir),
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
      env: loadEnv({ NODE_ENV: "test", STATE_DIR: dir }),
      classifier: createHeuristicClassifier(),
      planStore: createJsonlPlanStore(join(dir, "plans.jsonl")),
      memoryStore: createMemoryStore(dir),
      notificationDispatcher: {
        notifyRepairPlan: jest.fn()
      }
    });

    const createResponse = await server.inject({
      method: "POST",
      url: "/events/github-actions/failure",
      payload: createFailurePayload("3003")
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
    expect(
      (await createMemoryStore(dir).listEvents()).map((event) => event.type)
    ).toEqual(["failure-observed", "repair-requested"]);
  });

  it("rejects unsigned GitHub webhooks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const server = buildServer({
      env: loadEnv({
        NODE_ENV: "test",
        GITHUB_WEBHOOK_SECRET: "test-secret",
        STATE_DIR: dir
      }),
      classifier: createHeuristicClassifier(),
      planStore: createJsonlPlanStore(join(dir, "plans.jsonl")),
      memoryStore: createMemoryStore(dir)
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

  it("skips memory writes when memory is disabled", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const memoryStore = createMemoryStore(dir);
    const server = buildServer({
      env: loadEnv({
        NODE_ENV: "test",
        STATE_DIR: dir,
        LOOPCI_MEMORY_ENABLED: "false"
      }),
      classifier: createHeuristicClassifier(),
      planStore: createJsonlPlanStore(join(dir, "plans.jsonl")),
      memoryStore,
      notificationDispatcher: {
        notifyRepairPlan: jest.fn()
      }
    });

    const response = await server.inject({
      method: "POST",
      url: "/events/github-actions/failure",
      payload: createFailurePayload("4004")
    });

    expect(response.statusCode).toBe(202);
    expect(response.json().recognition).toBeNull();
    expect(await memoryStore.listEvents()).toEqual([]);
    expect(await memoryStore.listRecords()).toEqual([]);
  });

  it("returns memory records and recognition summaries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const memoryStore = createMemoryStore(dir);
    const server = buildServer({
      env: loadEnv({ NODE_ENV: "test", STATE_DIR: dir }),
      classifier: createHeuristicClassifier(),
      planStore: createJsonlPlanStore(join(dir, "plans.jsonl")),
      memoryStore,
      notificationDispatcher: {
        notifyRepairPlan: jest.fn()
      }
    });

    await server.inject({
      method: "POST",
      url: "/events/github-actions/failure",
      payload: createFailurePayload("5005")
    });
    await server.inject({
      method: "POST",
      url: "/events/github-actions/failure",
      payload: createFailurePayload("5006")
    });

    const listResponse = await server.inject({
      method: "GET",
      url: "/memory"
    });

    expect(listResponse.statusCode).toBe(200);
    const listedRecord = listResponse.json().records[0];
    expect(listedRecord).toMatchObject({
      record: {
        occurrenceCount: 2
      },
      recognition: {
        seenBefore: true,
        recurring: false,
        recognitionType: "exact-fingerprint"
      }
    });

    const detailResponse = await server.inject({
      method: "GET",
      url: `/memory/${encodeURIComponent(listedRecord.record.id)}`
    });

    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json()).toMatchObject({
      found: true,
      record: {
        id: listedRecord.record.id,
        occurrenceCount: 2
      },
      recognition: {
        seenBefore: true
      }
    });
    expect(detailResponse.json().events).toHaveLength(2);
  });

  it("returns 404 for unknown memory ids", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-"));
    const server = buildServer({
      env: loadEnv({ NODE_ENV: "test", STATE_DIR: dir }),
      classifier: createHeuristicClassifier(),
      planStore: createJsonlPlanStore(join(dir, "plans.jsonl")),
      memoryStore: createMemoryStore(dir)
    });

    const response = await server.inject({
      method: "GET",
      url: "/memory/missing"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      found: false,
      reason: "memory-not-found"
    });
  });
});
