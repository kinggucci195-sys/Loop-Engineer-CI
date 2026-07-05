import type { RepairPlan } from "@loopci/contracts";
import type { LoopCiEnv } from "@loopci/config";
import type { Logger } from "@loopci/logger";
import {
  createEmptyNotificationConfig,
  loadNotificationConfig,
  type NotificationConfig,
  type NotificationUser
} from "./notification-config";
import { sendEmailRepairPlanNotification } from "./email";
import { sendSlackRepairPlanNotification } from "./slack";
import { sendTeamsRepairPlanNotification } from "./teams";

export interface NotificationDispatcher {
  notifyRepairPlan(plan: RepairPlan): Promise<void>;
}

export function createNoopNotificationDispatcher(): NotificationDispatcher {
  return {
    notifyRepairPlan: async () => undefined
  };
}

export function createNotificationDispatcher(
  env: LoopCiEnv,
  logger: Logger
): NotificationDispatcher {
  if (!env.LOOPCI_NOTIFICATIONS_ENABLED) {
    return createNoopNotificationDispatcher();
  }

  return {
    notifyRepairPlan: async (plan) => {
      let config = createEmptyNotificationConfig();

      try {
        config = await loadNotificationConfig(
          env.LOOPCI_NOTIFICATION_USERS_PATH
        );
      } catch (error) {
        logger.error(
          { error, filePath: env.LOOPCI_NOTIFICATION_USERS_PATH },
          "Failed to load notification routing config"
        );
      }

      const target = resolveNotificationTarget(plan, config);
      const teamsWebhookUrl =
        target.user?.teamsWebhookUrl ??
        config.defaultTeamsWebhookUrl ??
        env.LOOPCI_TEAMS_WEBHOOK_URL;
      const slackWebhookUrl =
        target.user?.slackWebhookUrl ??
        config.defaultSlackWebhookUrl ??
        env.LOOPCI_SLACK_WEBHOOK_URL;

      await Promise.all([
        notifyTeams(teamsWebhookUrl, plan, env, logger),
        notifySlack(slackWebhookUrl, plan, env, logger),
        notifyEmail(target.emails, plan, env, logger)
      ]);
    }
  };
}

export function resolveNotificationTarget(
  plan: RepairPlan,
  config: NotificationConfig
): {
  actor: string | undefined;
  user: NotificationUser | undefined;
  emails: string[];
} {
  const actor = plan.event.triggeringActor ?? plan.event.actor;
  const user = findUser(actor, config);
  const emails = new Set<string>(config.defaultEmails);

  if (user?.email) {
    emails.add(user.email);
  } else if (
    config.useCommitAuthorEmailFallback &&
    plan.event.commitAuthorEmail
  ) {
    emails.add(plan.event.commitAuthorEmail);
  }

  return {
    actor,
    user,
    emails: [...emails]
  };
}

function findUser(
  actor: string | undefined,
  config: NotificationConfig
): NotificationUser | undefined {
  if (!actor) {
    return undefined;
  }

  return config.users[actor] ?? config.users[actor.toLowerCase()];
}

async function notifyTeams(
  webhookUrl: string | undefined,
  plan: RepairPlan,
  env: LoopCiEnv,
  logger: Logger
) {
  if (!webhookUrl) {
    logger.debug(
      { planId: plan.id },
      "Skipping Teams notification because no webhook URL is configured"
    );
    return;
  }

  try {
    await sendTeamsRepairPlanNotification(webhookUrl, plan, env);
    logger.info({ planId: plan.id }, "Sent Teams repair-plan notification");
  } catch (error) {
    logger.error(
      { error, planId: plan.id },
      "Failed to send Teams notification"
    );
  }
}

async function notifyEmail(
  recipients: string[],
  plan: RepairPlan,
  env: LoopCiEnv,
  logger: Logger
) {
  if (recipients.length === 0) {
    logger.debug(
      { planId: plan.id },
      "Skipping email notification because no recipients were resolved"
    );
    return;
  }

  try {
    await sendEmailRepairPlanNotification(recipients, plan, env);
    logger.info(
      { planId: plan.id, recipientCount: recipients.length },
      "Sent email repair-plan notification"
    );
  } catch (error) {
    logger.error(
      { error, planId: plan.id },
      "Failed to send email notification"
    );
  }
}

async function notifySlack(
  webhookUrl: string | undefined,
  plan: RepairPlan,
  env: LoopCiEnv,
  logger: Logger
) {
  if (!webhookUrl) {
    logger.debug(
      { planId: plan.id },
      "Skipping Slack notification because no webhook URL is configured"
    );
    return;
  }

  try {
    await sendSlackRepairPlanNotification(webhookUrl, plan, env);
    logger.info({ planId: plan.id }, "Sent Slack repair-plan notification");
  } catch (error) {
    logger.error(
      { error, planId: plan.id },
      "Failed to send Slack notification"
    );
  }
}
