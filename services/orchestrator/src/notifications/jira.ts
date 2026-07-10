import type { LoopCiEnv } from "@loopci/config";
import type { RepairPlan } from "@loopci/contracts";
import { createOutboundAbortSignal } from "./outbound-timeout";
import { getFixRequestUrl, getPlanUrl } from "./render";

export interface JiraIssueResult {
  id: string;
  key: string;
  self: string;
}

export async function createJiraRepairPlanIssue(
  plan: RepairPlan,
  env: LoopCiEnv
): Promise<JiraIssueResult> {
  assertJiraConfig(env);

  const baseUrl = env.LOOPCI_JIRA_BASE_URL.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
    method: "POST",
    signal: createOutboundAbortSignal(env),
    headers: {
      accept: "application/json",
      authorization: `Basic ${Buffer.from(
        `${env.LOOPCI_JIRA_EMAIL}:${env.LOOPCI_JIRA_API_TOKEN}`,
        "utf8"
      ).toString("base64")}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      fields: {
        project: {
          key: env.LOOPCI_JIRA_PROJECT_KEY
        },
        issuetype: {
          name: env.LOOPCI_JIRA_ISSUE_TYPE
        },
        summary: `CI failure: ${plan.event.repository} ${plan.classification.kind}`,
        description: jiraDescription(plan, env),
        labels: [
          "loopci",
          "ci-failure",
          `risk-${plan.classification.risk}`,
          `kind-${plan.classification.kind}`
        ]
      }
    })
  });

  if (!response.ok) {
    throw new Error(
      `Jira issue creation failed with ${response.status}: ${await response.text()}`
    );
  }

  return (await response.json()) as JiraIssueResult;
}

function assertJiraConfig(env: LoopCiEnv): asserts env is LoopCiEnv & {
  LOOPCI_JIRA_BASE_URL: string;
  LOOPCI_JIRA_EMAIL: string;
  LOOPCI_JIRA_API_TOKEN: string;
  LOOPCI_JIRA_PROJECT_KEY: string;
} {
  const missing = [
    ["LOOPCI_JIRA_BASE_URL", env.LOOPCI_JIRA_BASE_URL],
    ["LOOPCI_JIRA_EMAIL", env.LOOPCI_JIRA_EMAIL],
    ["LOOPCI_JIRA_API_TOKEN", env.LOOPCI_JIRA_API_TOKEN],
    ["LOOPCI_JIRA_PROJECT_KEY", env.LOOPCI_JIRA_PROJECT_KEY]
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Jira issue creation requires ${missing.join(", ")} when LOOPCI_JIRA_CREATE_ISSUES=true.`
    );
  }
}

function jiraDescription(plan: RepairPlan, env: LoopCiEnv) {
  const actor = plan.event.triggeringActor ?? plan.event.actor ?? "unknown";
  const confidence = `${Math.round(plan.classification.confidence * 100)}%`;

  return {
    type: "doc",
    version: 1,
    content: [
      paragraph(
        `LoopCI created an evidence-backed repair plan for a failed CI run.`
      ),
      paragraph(plan.classification.summary),
      paragraph(`Repository: ${plan.event.repository}`),
      paragraph(`Branch: ${plan.event.branch}`),
      paragraph(`Workflow: ${plan.event.workflow}`),
      paragraph(`Triggered by: ${actor}`),
      paragraph(`Risk: ${plan.classification.risk}`),
      paragraph(`Confidence: ${confidence}`),
      paragraph(
        `Recommended checks: ${plan.classification.recommendedChecks.join(", ")}`
      ),
      paragraph(`Residual risk: ${plan.residualRisk}`),
      paragraph(`View diagnosis: ${getPlanUrl(plan, env)}`),
      paragraph(`Fix this error: ${getFixRequestUrl(plan, env)}`),
      paragraph(`GitHub run: ${plan.event.runUrl}`)
    ]
  };
}

function paragraph(text: string) {
  return {
    type: "paragraph",
    content: [
      {
        type: "text",
        text
      }
    ]
  };
}
