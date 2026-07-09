import type { RepairPlan } from "@loopci/contracts";
import type { LoopCiEnv } from "@loopci/config";
import { createOutboundAbortSignal } from "./outbound-timeout";
import { getFixRequestUrl, getPlanUrl } from "./render";

export async function sendTeamsRepairPlanNotification(
  webhookUrl: string,
  plan: RepairPlan,
  env: LoopCiEnv
) {
  const actor = plan.event.triggeringActor ?? plan.event.actor ?? "unknown";
  const owner = plan.ownership?.owner ?? actor;
  const ownerSource = plan.ownership?.source ?? "actor";
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    signal: createOutboundAbortSignal(env),
    body: JSON.stringify({
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          contentUrl: null,
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.4",
            body: [
              {
                type: "TextBlock",
                size: "Medium",
                weight: "Bolder",
                text: `LoopCI found a ${plan.classification.kind} failure`
              },
              {
                type: "TextBlock",
                wrap: true,
                text: plan.classification.summary
              },
              {
                type: "FactSet",
                facts: [
                  { title: "Repository", value: plan.event.repository },
                  { title: "Branch", value: plan.event.branch },
                  { title: "Workflow", value: plan.event.workflow },
                  { title: "Owner", value: owner },
                  { title: "Owner source", value: ownerSource },
                  { title: "Triggered by", value: actor },
                  { title: "Risk", value: plan.classification.risk },
                  {
                    title: "Confidence",
                    value: `${Math.round(
                      plan.classification.confidence * 100
                    )}%`
                  }
                ]
              }
            ],
            actions: [
              {
                type: "Action.OpenUrl",
                title: "View Diagnosis",
                url: getPlanUrl(plan, env)
              },
              {
                type: "Action.OpenUrl",
                title: "Fix This Error",
                url: getFixRequestUrl(plan, env)
              },
              {
                type: "Action.OpenUrl",
                title: "Open GitHub Run",
                url: plan.event.runUrl
              }
            ]
          }
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(
      `Teams notification failed with ${response.status}: ${await response.text()}`
    );
  }
}
