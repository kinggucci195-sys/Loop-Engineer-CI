import {
  findMemoryForPlan,
  formatConfidence,
  getCurrentPlan,
  getDashboardMetrics,
  getDashboardTextCorpus,
  loadDashboardState,
  type DashboardState
} from "../dashboard-model";

const originalEnv = process.env;

describe("dashboard model", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns an honest disconnected state without an orchestrator URL", async () => {
    delete process.env.LOOPCI_ORCHESTRATOR_URL;
    delete process.env.NEXT_PUBLIC_LOOPCI_ORCHESTRATOR_URL;

    await expect(loadDashboardState()).resolves.toEqual({
      connected: false,
      plans: [],
      memory: []
    });
  });

  it("loads plans and memory from orchestrator endpoints", async () => {
    process.env.LOOPCI_ORCHESTRATOR_URL = "http://orchestrator.test/";
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input);

        if (url.endsWith("/ready")) {
          return jsonResponse({ ok: true, planCount: 1 });
        }

        if (url.endsWith("/plans")) {
          return jsonResponse({
            plans: [
              {
                id: "plan-1",
                event: {
                  repository: "owner/repo",
                  workflow: "CI",
                  runUrl: "https://github.com/owner/repo/actions/runs/1",
                  branch: "main",
                  failedJob: "validate",
                  failedStep: "npm test"
                },
                classification: {
                  kind: "unit-test",
                  risk: "low",
                  summary: "Unit tests failed.",
                  requiresHuman: false
                },
                status: "classified",
                branchName: "loopci/repair-plan-1",
                goal: "Repair the failing unit test.",
                createdAt: "2026-07-06T03:00:00.000Z",
                memoryRecordId: "memory-1"
              }
            ]
          });
        }

        if (url.endsWith("/memory")) {
          return jsonResponse({
            records: [
              {
                record: {
                  id: "memory-1",
                  occurrenceCount: 2,
                  previousRepairCount: 1,
                  lastObservedAt: "2026-07-06T03:00:00.000Z",
                  relationships: {
                    repository: "owner/repo",
                    workflow: "CI",
                    owner: "platform"
                  }
                },
                recognition: {
                  confidence: 0.91,
                  seenBefore: true,
                  recurring: false,
                  confidenceReasoning: ["Seen 2 times"]
                }
              }
            ]
          });
        }

        return jsonResponse({
          notificationsEnabled: true,
          routingConfigPathConfigured: true,
          routingConfigLoaded: true,
          usersConfigured: 1,
          commitAuthorEmailFallback: true,
          channels: {
            teams: {
              configured: true,
              source: "per-user",
              userRoutes: 1
            },
            slack: {
              configured: false,
              source: "none",
              userRoutes: 0
            },
            email: {
              configured: false,
              source: "commit-author-fallback",
              defaultRecipients: 0,
              userRoutes: 0,
              smtpConfigured: false
            },
            jira: {
              configured: false,
              createIssues: false,
              projectKeyConfigured: false
            }
          }
        });
      });

    const state = await loadDashboardState();

    expect(fetchMock).toHaveBeenCalledWith("http://orchestrator.test/ready", {
      cache: "no-store"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://orchestrator.test/integrations/status",
      {
        cache: "no-store"
      }
    );
    expect(state.connected).toBe(true);
    expect(state.plans).toHaveLength(1);
    expect(state.memory).toHaveLength(1);
    expect(state.integrations?.channels).toEqual([
      {
        name: "Teams",
        state: "configured",
        source: "Actor route",
        detail: "1 actor route"
      },
      {
        name: "Slack",
        state: "not-configured",
        source: "Not configured",
        detail: "No webhook route"
      },
      {
        name: "Email",
        state: "not-configured",
        source: "SMTP missing",
        detail: "Commit author fallback"
      },
      {
        name: "Jira",
        state: "not-configured",
        source: "Disabled",
        detail: "No project key"
      }
    ]);
    expect(findMemoryForPlan(state.plans[0] ?? null, state.memory)?.id).toBe(
      "memory-1"
    );
  });

  it("marks integrations as disabled when notifications are off", async () => {
    process.env.LOOPCI_ORCHESTRATOR_URL = "http://orchestrator.test/";
    jest.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);

      if (url.endsWith("/ready")) {
        return jsonResponse({ ok: true, planCount: 0 });
      }

      if (url.endsWith("/plans")) {
        return jsonResponse({ plans: [] });
      }

      if (url.endsWith("/memory")) {
        return jsonResponse({ records: [] });
      }

      return jsonResponse({
        notificationsEnabled: false,
        routingConfigPathConfigured: false,
        routingConfigLoaded: false,
        usersConfigured: 0,
        commitAuthorEmailFallback: true,
        channels: {
          teams: {
            configured: false,
            source: "env",
            userRoutes: 0
          },
          slack: {
            configured: false,
            source: "env",
            userRoutes: 0
          },
          email: {
            configured: false,
            source: "commit-author-fallback",
            defaultRecipients: 0,
            userRoutes: 0,
            smtpConfigured: true
          },
          jira: {
            configured: false,
            createIssues: true,
            projectKeyConfigured: true
          }
        }
      });
    });

    const state = await loadDashboardState();

    expect(state.integrations?.channels.map((channel) => channel.state)).toEqual(
      ["disabled", "disabled", "disabled", "disabled"]
    );
  });

  it("sends the private API token from server env when configured", async () => {
    process.env.LOOPCI_ORCHESTRATOR_URL = "http://orchestrator.test/";
    process.env.LOOPCI_API_TOKEN = "super-secret-token";
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input);

        if (url.endsWith("/ready")) {
          return jsonResponse({ ok: true, planCount: 0 });
        }

        if (url.endsWith("/plans")) {
          return jsonResponse({ plans: [] });
        }

        if (url.endsWith("/memory")) {
          return jsonResponse({ records: [] });
        }

        return jsonResponse({
          notificationsEnabled: true,
          routingConfigPathConfigured: false,
          routingConfigLoaded: false,
          usersConfigured: 0,
          commitAuthorEmailFallback: true,
          channels: {}
        });
      });

    await loadDashboardState();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://orchestrator.test/plans",
      {
        cache: "no-store",
        headers: {
          authorization: "Bearer super-secret-token"
        }
      }
    );
  });

  it("derives metrics from real state instead of fixed demo values", () => {
    const state: DashboardState = {
      connected: true,
      plans: [
        plan("plan-1", "low", false, "classified"),
        plan("plan-2", "high", true, "classified"),
        plan("plan-3", "low", false, "closed")
      ],
      memory: [
        {
          id: "memory-1",
          repository: "owner/repo",
          workflow: "CI",
          occurrenceCount: 2,
          previousRepairCount: 1,
          lastObservedAt: "2026-07-06T03:00:00.000Z",
          confidence: 0.8,
          confidenceReasoning: [],
          seenBefore: true,
          recurring: false
        }
      ]
    };

    expect(getDashboardMetrics(state)).toEqual([
      {
        label: "Active plans",
        value: "2",
        detail: "Open repair plans"
      },
      {
        label: "Recognized failures",
        value: "1",
        detail: "Matched to memory"
      },
      {
        label: "Ready for fix",
        value: "2",
        detail: "Low-risk plans"
      },
      {
        label: "Review gates",
        value: "1",
        detail: "Human approval required"
      }
    ]);
  });

  it("selects the newest plan by creation time", () => {
    expect(
      getCurrentPlan([
        plan("older", "low", false, "classified", "2026-07-06T01:00:00.000Z"),
        plan("newer", "low", false, "classified", "2026-07-06T02:00:00.000Z")
      ])?.id
    ).toBe("newer");
  });

  it("keeps primary dashboard copy out of generic marketing language", () => {
    const state: DashboardState = {
      connected: true,
      plans: [plan("plan-1", "low", false, "classified")],
      memory: []
    };

    expect(getDashboardTextCorpus(state)).not.toMatch(
      /\b(AI|magic|revolutionary|autonomous|agentic)\b/i
    );
  });

  it("formats confidence as a percentage", () => {
    expect(formatConfidence(0.914)).toBe("91%");
  });
});

function plan(
  id: string,
  risk: "low" | "medium" | "high",
  requiresHuman: boolean,
  status: string,
  createdAt = "2026-07-06T03:00:00.000Z"
) {
  return {
    id,
    repository: "owner/repo",
    workflow: "CI",
    runUrl: "https://github.com/owner/repo/actions/runs/1",
    branch: "main",
    failedJob: "validate",
    failedStep: "npm test",
    createdAt,
    status,
    branchName: `loopci/${id}`,
    goal: "Repair failing CI.",
    risk,
    kind: "unit-test",
    summary: "Unit tests failed.",
    requiresHuman
  };
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body
  } as Response;
}
