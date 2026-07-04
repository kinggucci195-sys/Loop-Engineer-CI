import type { RepairPlan } from "@loopci/contracts";
import type { LoopCiEnv } from "@loopci/config";

export function getPlanUrl(plan: RepairPlan, env: LoopCiEnv): string {
  const baseUrl = env.LOOPCI_PUBLIC_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return plan.event.runUrl;
  }

  return `${baseUrl}/plans/${encodeURIComponent(plan.id)}`;
}

export function getFixRequestUrl(plan: RepairPlan, env: LoopCiEnv): string {
  const baseUrl = env.LOOPCI_PUBLIC_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return plan.event.runUrl;
  }

  return `${baseUrl}/actions/plans/${encodeURIComponent(plan.id)}/request-fix`;
}

export function renderPlainTextRepairPlan(plan: RepairPlan, env: LoopCiEnv) {
  const actor = plan.event.triggeringActor ?? plan.event.actor ?? "unknown";

  return [
    `LoopCI found a ${plan.classification.kind} failure.`,
    "",
    `Repository: ${plan.event.repository}`,
    `Branch: ${plan.event.branch}`,
    `Workflow: ${plan.event.workflow}`,
    `Triggered by: ${actor}`,
    `Risk: ${plan.classification.risk}`,
    `Confidence: ${Math.round(plan.classification.confidence * 100)}%`,
    "",
    `Cause: ${plan.classification.summary}`,
    "",
    `Recommended checks:`,
    ...plan.classification.recommendedChecks.map((check) => `- ${check}`),
    "",
    `View diagnosis: ${getPlanUrl(plan, env)}`,
    `Fix this error: ${getFixRequestUrl(plan, env)}`,
    `GitHub run: ${plan.event.runUrl}`
  ].join("\n");
}

export function renderHtmlRepairPlan(plan: RepairPlan, env: LoopCiEnv) {
  const actor = escapeHtml(
    plan.event.triggeringActor ?? plan.event.actor ?? "unknown"
  );
  const planUrl = getPlanUrl(plan, env);
  const fixUrl = getFixRequestUrl(plan, env);

  return [
    `<h2>LoopCI found a ${escapeHtml(plan.classification.kind)} failure</h2>`,
    `<p>${escapeHtml(plan.classification.summary)}</p>`,
    `<table>`,
    row("Repository", plan.event.repository),
    row("Branch", plan.event.branch),
    row("Workflow", plan.event.workflow),
    row("Triggered by", actor),
    row("Risk", plan.classification.risk),
    row("Confidence", `${Math.round(plan.classification.confidence * 100)}%`),
    `</table>`,
    `<p>`,
    `<a href="${escapeAttribute(planUrl)}">View diagnosis</a>`,
    ` | `,
    `<a href="${escapeAttribute(fixUrl)}">Fix this error</a>`,
    ` | `,
    `<a href="${escapeAttribute(plan.event.runUrl)}">Open GitHub run</a>`,
    `</p>`
  ].join("");
}

function row(label: string, value: string) {
  return `<tr><td><strong>${escapeHtml(label)}</strong></td><td>${escapeHtml(
    value
  )}</td></tr>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
