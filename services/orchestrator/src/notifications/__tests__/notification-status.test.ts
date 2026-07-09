import { loadEnv } from "@loopci/config";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getNotificationIntegrationStatus } from "../notification-status";

describe("notification integration status", () => {
  it("reports disabled channels without exposing secrets", async () => {
    const status = await getNotificationIntegrationStatus(
      loadEnv({
        NODE_ENV: "test",
        LOOPCI_NOTIFICATIONS_ENABLED: "false",
        LOOPCI_TEAMS_WEBHOOK_URL: "https://teams.example.com/webhook",
        LOOPCI_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/default",
        LOOPCI_SMTP_HOST: "smtp.example.com",
        LOOPCI_EMAIL_FROM: "loopci@example.com",
        LOOPCI_JIRA_CREATE_ISSUES: "true",
        LOOPCI_JIRA_BASE_URL: "https://example.atlassian.net",
        LOOPCI_JIRA_EMAIL: "loopci@example.com",
        LOOPCI_JIRA_API_TOKEN: "secret-token",
        LOOPCI_JIRA_PROJECT_KEY: "ENG"
      })
    );

    expect(status.notificationsEnabled).toBe(false);
    expect(status.channels.teams.configured).toBe(false);
    expect(status.channels.slack.configured).toBe(false);
    expect(status.channels.email.configured).toBe(false);
    expect(status.channels.jira.configured).toBe(false);
    expect(JSON.stringify(status)).not.toContain("secret-token");
    expect(JSON.stringify(status)).not.toContain("webhook");
  });

  it("summarizes env and routing-file channels with redacted counts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-notification-status-"));
    const routingPath = join(dir, "loopci.notifications.json");
    await writeFile(
      routingPath,
      JSON.stringify({
        defaultEmails: ["platform@example.com"],
        defaultTeamsWebhookUrl: "https://teams.example.com/default",
        users: {
          "kinggucci195-sys": {
            email: "dev@example.com",
            slackWebhookUrl: "https://hooks.slack.com/services/developer"
          }
        }
      }),
      "utf8"
    );

    const status = await getNotificationIntegrationStatus(
      loadEnv({
        NODE_ENV: "test",
        LOOPCI_NOTIFICATION_USERS_PATH: routingPath,
        LOOPCI_SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/default",
        LOOPCI_SMTP_HOST: "smtp.example.com",
        LOOPCI_EMAIL_FROM: "loopci@example.com"
      })
    );

    expect(status).toMatchObject({
      notificationsEnabled: true,
      routingConfigLoaded: true,
      usersConfigured: 1,
      channels: {
        teams: {
          configured: true,
          source: "routing-file",
          userRoutes: 0
        },
        slack: {
          configured: true,
          source: "per-user",
          userRoutes: 1
        },
        email: {
          configured: true,
          source: "routing-file",
          defaultRecipients: 1,
          userRoutes: 1,
          smtpConfigured: true
        },
        jira: {
          configured: false,
          createIssues: false,
          projectKeyConfigured: false
        }
      }
    });
    expect(JSON.stringify(status)).not.toContain("platform@example.com");
    expect(JSON.stringify(status)).not.toContain("hooks.slack.com");
  });

  it("reports a broken routing file without failing status generation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-notification-status-"));
    const routingPath = join(dir, "loopci.notifications.json");
    await writeFile(routingPath, "{", "utf8");

    const status = await getNotificationIntegrationStatus(
      loadEnv({
        NODE_ENV: "test",
        LOOPCI_NOTIFICATION_USERS_PATH: routingPath
      })
    );

    expect(status.routingConfigLoaded).toBe(false);
    expect(status.routingConfigError).toBeDefined();
    expect(status.usersConfigured).toBe(0);
  });
});
