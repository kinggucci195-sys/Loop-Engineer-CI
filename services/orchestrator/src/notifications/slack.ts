import type { RepairPlan } from "@loopci/contracts";
import type { LoopCiEnv } from "@loopci/config";
import { createOutboundAbortSignal } from "./outbound-timeout";
import { getFixRequestUrl, getPlanUrl } from "./render";

export async function sendSlackRepairPlanNotification(
  webhookUrl: string,
  plan: RepairPlan,
  env: LoopCiEnv
) {
  const actor = plan.event.triggeringActor ?? plan.event.actor ?? "unknown";
  const owner = plan.ownership?.owner ?? actor;
  const ownerSource = plan.ownership?.source ?? "actor";
  const confidence = `${Math.round(plan.classification.confidence * 100)}%`;
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    signal: createOutboundAbortSignal(env),
    body: JSON.stringify({
      text: `LoopCI found a ${plan.classification.kind} failure in ${plan.event.repository}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `Build failed: ${plan.event.repository}`,
            emoji: false
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: plan.classification.summary
          }
        },
        {
          type: "section",
          fields: [
            markdownField("Branch", plan.event.branch),
            markdownField("Workflow", plan.event.workflow),
            markdownField("Owner", owner),
            markdownField("Owner source", ownerSource),
            markdownField("Triggered by", actor),
            markdownField("Failure", plan.classification.kind),
            markdownField("Risk", plan.classification.risk),
            markdownField("Confidence", confidence)
          ]
        },
        {
          type: "actions",
          elements: [
            urlButton("View diagnosis", getPlanUrl(plan, env), "primary"),
            urlButton("Fix this error", getFixRequestUrl(plan, env), "danger"),
            urlButton("Open GitHub run", plan.event.runUrl)
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(
      `Slack notification failed with ${response.status}: ${await response.text()}`
    );
  }
}

function markdownField(label: string, value: string) {
  return {
    type: "mrkdwn",
    text: `*${label}:*\n${value}`
  };
}

function urlButton(text: string, url: string, style?: "primary" | "danger") {
  return {
    type: "button",
    text: {
      type: "plain_text",
      text,
      emoji: false
    },
    url,
    ...(style ? { style } : {})
  };
}
