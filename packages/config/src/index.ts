import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  LOOPCI_AI_PROVIDER: z.enum(["heuristic", "openai"]).default("heuristic"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.5"),
  LOOPCI_POLICY_PATH: z.string().optional(),
  LOOPCI_PUBLIC_URL: z.string().url().optional(),
  LOOPCI_NOTIFICATIONS_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  LOOPCI_NOTIFICATION_USERS_PATH: z.string().optional(),
  LOOPCI_TEAMS_WEBHOOK_URL: z.string().url().optional(),
  LOOPCI_SLACK_WEBHOOK_URL: z.string().url().optional(),
  LOOPCI_EMAIL_FROM: z.string().email().optional(),
  LOOPCI_SMTP_HOST: z.string().optional(),
  LOOPCI_SMTP_PORT: z.coerce.number().int().positive().default(587),
  LOOPCI_SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  LOOPCI_SMTP_USER: z.string().optional(),
  LOOPCI_SMTP_PASSWORD: z.string().optional(),
  STATE_DIR: z.string().default("../../state"),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_TOKEN: z.string().optional()
});

export type LoopCiEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): LoopCiEnv {
  const env = envSchema.parse(source);

  if (env.LOOPCI_AI_PROVIDER === "openai" && !env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is required when LOOPCI_AI_PROVIDER=openai."
    );
  }

  return env;
}
