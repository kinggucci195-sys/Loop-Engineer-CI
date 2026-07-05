import { loadEnv } from "@loopci/config";
import { createNotificationTestPlan } from "./notification-test-fixture";
import { createJiraRepairPlanIssue } from "../jira";

describe("Jira issue creation", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates an issue with repair-plan context", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "10001",
          key: "LOOP-42",
          self: "https://example.atlassian.net/rest/api/3/issue/10001"
        }),
        { status: 201 }
      )
    );
    const env = loadEnv({
      NODE_ENV: "test",
      LOOPCI_PUBLIC_URL: "https://loopci.example.com",
      LOOPCI_JIRA_CREATE_ISSUES: "true",
      LOOPCI_JIRA_BASE_URL: "https://example.atlassian.net",
      LOOPCI_JIRA_EMAIL: "loopci@example.com",
      LOOPCI_JIRA_API_TOKEN: "jira-token",
      LOOPCI_JIRA_PROJECT_KEY: "LOOP",
      LOOPCI_JIRA_ISSUE_TYPE: "Bug"
    });

    const issue = await createJiraRepairPlanIssue(
      createNotificationTestPlan(),
      env
    );

    const [url, request] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(request?.body));

    expect(url).toBe("https://example.atlassian.net/rest/api/3/issue");
    expect(request?.headers).toEqual(
      expect.objectContaining({
        authorization: expect.stringMatching(/^Basic /)
      })
    );
    expect(body.fields.project.key).toBe("LOOP");
    expect(body.fields.issuetype.name).toBe("Bug");
    expect(body.fields.labels).toEqual(
      expect.arrayContaining(["loopci", "ci-failure", "risk-low"])
    );
    expect(JSON.stringify(body.fields.description)).toContain(
      "https://loopci.example.com/actions/plans/plan-1/request-fix"
    );
    expect(issue.key).toBe("LOOP-42");
  });

  it("requires Jira credentials when issue creation is enabled", async () => {
    await expect(
      createJiraRepairPlanIssue(
        createNotificationTestPlan(),
        loadEnv({
          NODE_ENV: "test",
          LOOPCI_JIRA_CREATE_ISSUES: "true"
        })
      )
    ).rejects.toThrow("LOOPCI_JIRA_BASE_URL");
  });

  it("throws when Jira rejects the request", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("bad issue", { status: 400 }));

    await expect(
      createJiraRepairPlanIssue(
        createNotificationTestPlan(),
        loadEnv({
          NODE_ENV: "test",
          LOOPCI_JIRA_CREATE_ISSUES: "true",
          LOOPCI_JIRA_BASE_URL: "https://example.atlassian.net",
          LOOPCI_JIRA_EMAIL: "loopci@example.com",
          LOOPCI_JIRA_API_TOKEN: "jira-token",
          LOOPCI_JIRA_PROJECT_KEY: "LOOP"
        })
      )
    ).rejects.toThrow("Jira issue creation failed");
  });
});
