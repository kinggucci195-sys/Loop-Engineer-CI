import type { LoopCiEnv } from "@loopci/config";
import {
  createEmptyNotificationConfig,
  loadNotificationConfig,
  type NotificationConfig
} from "./notification-config";

type RouteSource =
  | "env"
  | "routing-file"
  | "per-user"
  | "smtp"
  | "commit-author-fallback"
  | "none";

export interface NotificationIntegrationStatus {
  notificationsEnabled: boolean;
  routingConfigPathConfigured: boolean;
  routingConfigLoaded: boolean;
  routingConfigError?: string;
  usersConfigured: number;
  commitAuthorEmailFallback: boolean;
  channels: {
    teams: {
      configured: boolean;
      source: RouteSource;
      userRoutes: number;
    };
    slack: {
      configured: boolean;
      source: RouteSource;
      userRoutes: number;
    };
    email: {
      configured: boolean;
      source: RouteSource;
      defaultRecipients: number;
      userRoutes: number;
      smtpConfigured: boolean;
    };
    jira: {
      configured: boolean;
      createIssues: boolean;
      projectKeyConfigured: boolean;
    };
  };
}

export async function getNotificationIntegrationStatus(
  env: LoopCiEnv
): Promise<NotificationIntegrationStatus> {
  const loaded = await loadConfigForStatus(env.LOOPCI_NOTIFICATION_USERS_PATH);
  const config = loaded.config;
  const users = Object.values(config.users);
  const teamsUserRoutes = users.filter((user) => user.teamsWebhookUrl).length;
  const slackUserRoutes = users.filter((user) => user.slackWebhookUrl).length;
  const emailUserRoutes = users.filter((user) => user.email).length;
  const smtpConfigured = Boolean(env.LOOPCI_SMTP_HOST && env.LOOPCI_EMAIL_FROM);
  const jiraReady = Boolean(
    env.LOOPCI_JIRA_CREATE_ISSUES &&
      env.LOOPCI_JIRA_BASE_URL &&
      env.LOOPCI_JIRA_EMAIL &&
      env.LOOPCI_JIRA_API_TOKEN &&
      env.LOOPCI_JIRA_PROJECT_KEY
  );
  const teamsSource = resolveChatSource({
    userRoutes: teamsUserRoutes,
    configDefault: config.defaultTeamsWebhookUrl,
    envDefault: env.LOOPCI_TEAMS_WEBHOOK_URL
  });
  const slackSource = resolveChatSource({
    userRoutes: slackUserRoutes,
    configDefault: config.defaultSlackWebhookUrl,
    envDefault: env.LOOPCI_SLACK_WEBHOOK_URL
  });
  const emailSource = resolveEmailSource(config, emailUserRoutes);

  return {
    notificationsEnabled: env.LOOPCI_NOTIFICATIONS_ENABLED,
    routingConfigPathConfigured: Boolean(env.LOOPCI_NOTIFICATION_USERS_PATH),
    routingConfigLoaded: loaded.loaded,
    ...(loaded.error ? { routingConfigError: loaded.error } : {}),
    usersConfigured: users.length,
    commitAuthorEmailFallback: config.useCommitAuthorEmailFallback,
    channels: {
      teams: {
        configured:
          env.LOOPCI_NOTIFICATIONS_ENABLED && teamsSource.source !== "none",
        source: teamsSource.source,
        userRoutes: teamsUserRoutes
      },
      slack: {
        configured:
          env.LOOPCI_NOTIFICATIONS_ENABLED && slackSource.source !== "none",
        source: slackSource.source,
        userRoutes: slackUserRoutes
      },
      email: {
        configured:
          env.LOOPCI_NOTIFICATIONS_ENABLED &&
          smtpConfigured &&
          emailSource !== "none",
        source: emailSource,
        defaultRecipients: config.defaultEmails.length,
        userRoutes: emailUserRoutes,
        smtpConfigured
      },
      jira: {
        configured: env.LOOPCI_NOTIFICATIONS_ENABLED && jiraReady,
        createIssues: env.LOOPCI_JIRA_CREATE_ISSUES,
        projectKeyConfigured: Boolean(env.LOOPCI_JIRA_PROJECT_KEY)
      }
    }
  };
}

async function loadConfigForStatus(filePath: string | undefined): Promise<{
  config: NotificationConfig;
  loaded: boolean;
  error?: string;
}> {
  if (!filePath) {
    return {
      config: createEmptyNotificationConfig(),
      loaded: false
    };
  }

  try {
    return {
      config: await loadNotificationConfig(filePath),
      loaded: true
    };
  } catch (error) {
    return {
      config: createEmptyNotificationConfig(),
      loaded: false,
      error:
        error instanceof Error
          ? error.message
          : "Notification routing config could not be loaded."
    };
  }
}

function resolveChatSource(input: {
  userRoutes: number;
  configDefault: string | undefined;
  envDefault: string | undefined;
}): { source: RouteSource } {
  if (input.userRoutes > 0) {
    return { source: "per-user" };
  }

  if (input.configDefault) {
    return { source: "routing-file" };
  }

  if (input.envDefault) {
    return { source: "env" };
  }

  return { source: "none" };
}

function resolveEmailSource(
  config: NotificationConfig,
  userRoutes: number
): RouteSource {
  if (config.defaultEmails.length > 0) {
    return "routing-file";
  }

  if (userRoutes > 0) {
    return "per-user";
  }

  if (config.useCommitAuthorEmailFallback) {
    return "commit-author-fallback";
  }

  return "none";
}
