import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  LOOPCI_AI_PROVIDER: z.enum(["heuristic", "openai"]).default("heuristic"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.5"),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_TOKEN: z.string().optional()
});

export type LoopCiEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): LoopCiEnv {
  const env = envSchema.parse(source);

  if (env.LOOPCI_AI_PROVIDER === "openai" && !env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when LOOPCI_AI_PROVIDER=openai.");
  }

  return env;
}
