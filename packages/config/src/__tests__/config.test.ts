import { loadEnv } from "../index";

describe("loadEnv", () => {
  it("loads defaults for local development", () => {
    const env = loadEnv({});

    expect(env.PORT).toBe(4000);
    expect(env.LOOPCI_AI_PROVIDER).toBe("heuristic");
    expect(env.LOOPCI_NOTIFICATIONS_ENABLED).toBe(true);
    expect(env.LOOPCI_MEMORY_ENABLED).toBe(true);
    expect(env.LOOPCI_ALLOW_UNSIGNED_EVENTS).toBe(false);
    expect(env.LOOPCI_OUTBOUND_TIMEOUT_MS).toBe(5000);
    expect(env.LOOPCI_SLACK_WEBHOOK_URL).toBeUndefined();
    expect(env.LOOPCI_JIRA_CREATE_ISSUES).toBe(false);
    expect(env.LOOPCI_JIRA_ISSUE_TYPE).toBe("Bug");
  });

  it("requires an OpenAI key when the OpenAI provider is selected", () => {
    expect(() => loadEnv({ LOOPCI_AI_PROVIDER: "openai" })).toThrow(
      "OPENAI_API_KEY"
    );
  });
});
