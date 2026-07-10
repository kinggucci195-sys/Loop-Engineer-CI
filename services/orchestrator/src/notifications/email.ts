import nodemailer from "nodemailer";
import type { RepairPlan } from "@loopci/contracts";
import type { LoopCiEnv } from "@loopci/config";
import { getOutboundTimeoutMs } from "./outbound-timeout";
import { renderHtmlRepairPlan, renderPlainTextRepairPlan } from "./render";

export async function sendEmailRepairPlanNotification(
  recipients: string[],
  plan: RepairPlan,
  env: LoopCiEnv
) {
  if (!env.LOOPCI_SMTP_HOST || !env.LOOPCI_EMAIL_FROM) {
    throw new Error(
      "Email notification requires LOOPCI_SMTP_HOST and LOOPCI_EMAIL_FROM."
    );
  }

  const transporter = nodemailer.createTransport({
    host: env.LOOPCI_SMTP_HOST,
    port: env.LOOPCI_SMTP_PORT,
    secure: env.LOOPCI_SMTP_SECURE,
    connectionTimeout: getOutboundTimeoutMs(env),
    socketTimeout: getOutboundTimeoutMs(env),
    auth:
      env.LOOPCI_SMTP_USER && env.LOOPCI_SMTP_PASSWORD
        ? {
            user: env.LOOPCI_SMTP_USER,
            pass: env.LOOPCI_SMTP_PASSWORD
          }
        : undefined
  });

  await transporter.sendMail({
    from: env.LOOPCI_EMAIL_FROM,
    to: recipients,
    subject: `LoopCI: ${plan.classification.kind} failure in ${plan.event.repository}`,
    text: renderPlainTextRepairPlan(plan, env),
    html: renderHtmlRepairPlan(plan, env)
  });
}
