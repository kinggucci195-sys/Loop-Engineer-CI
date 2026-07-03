import { ciFailureEventSchema, type CiFailureEvent } from "@loopci/contracts";
import { z } from "zod";

const workflowRunWebhookSchema = z.object({
  action: z.string(),
  repository: z.object({
    full_name: z.string().min(1)
  }),
  workflow_run: z.object({
    id: z.number(),
    name: z.string().min(1).nullable().optional(),
    html_url: z.string().url(),
    head_sha: z.string().min(6),
    head_branch: z.string().min(1).nullable().optional(),
    conclusion: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    event: z.string().nullable().optional()
  })
});

const failedConclusions = new Set([
  "failure",
  "timed_out",
  "cancelled",
  "action_required"
]);

export function createCiFailureEventFromGitHubWebhook(
  eventName: string | string[] | undefined,
  payload: unknown
): CiFailureEvent | null {
  const name = Array.isArray(eventName) ? eventName[0] : eventName;

  if (name !== "workflow_run") {
    return null;
  }

  const webhook = workflowRunWebhookSchema.parse(payload);
  const conclusion = webhook.workflow_run.conclusion ?? "unknown";

  if (
    webhook.action !== "completed" ||
    !failedConclusions.has(conclusion.toLowerCase())
  ) {
    return null;
  }

  const workflowName = webhook.workflow_run.name ?? "GitHub Actions workflow";
  const branch = webhook.workflow_run.head_branch ?? "unknown";
  const runId = String(webhook.workflow_run.id);
  const logExcerpt = [
    `GitHub workflow_run webhook reported a failed run.`,
    `Workflow: ${workflowName}`,
    `Conclusion: ${conclusion}`,
    `Status: ${webhook.workflow_run.status ?? "unknown"}`,
    `Trigger: ${webhook.workflow_run.event ?? "unknown"}`,
    `Run URL: ${webhook.workflow_run.html_url}`
  ].join("\n");

  return ciFailureEventSchema.parse({
    provider: "github-actions",
    repository: webhook.repository.full_name,
    workflow: workflowName,
    runId,
    runUrl: webhook.workflow_run.html_url,
    commitSha: webhook.workflow_run.head_sha,
    branch,
    failedJob: workflowName,
    failedStep: "workflow_run",
    logExcerpt
  });
}
