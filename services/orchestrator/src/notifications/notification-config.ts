import { readFile } from "node:fs/promises";
import { z } from "zod";

const notificationUserSchema = z.object({
  displayName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  teamsWebhookUrl: z.string().url().optional(),
  slackWebhookUrl: z.string().url().optional()
});

const notificationConfigSchema = z.object({
  defaultEmails: z.array(z.string().email()).default([]),
  defaultTeamsWebhookUrl: z.string().url().optional(),
  defaultSlackWebhookUrl: z.string().url().optional(),
  useCommitAuthorEmailFallback: z.boolean().default(true),
  users: z.record(notificationUserSchema).default({})
});

export type NotificationConfig = z.infer<typeof notificationConfigSchema>;
export type NotificationUser = z.infer<typeof notificationUserSchema>;

export function createEmptyNotificationConfig(): NotificationConfig {
  return {
    defaultEmails: [],
    useCommitAuthorEmailFallback: true,
    users: {}
  };
}

export async function loadNotificationConfig(
  filePath: string | undefined
): Promise<NotificationConfig> {
  if (!filePath) {
    return createEmptyNotificationConfig();
  }

  const contents = await readFile(filePath, "utf8");
  return notificationConfigSchema.parse(JSON.parse(contents));
}
