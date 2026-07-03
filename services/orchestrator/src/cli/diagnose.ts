import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadEnv } from "@loopci/config";
import { ciFailureEventSchema } from "@loopci/contracts";
import { createFailureClassifier } from "../ai/classifier";
import { createRepairPlan } from "../domain/repair-plan";

function renderPlanMarkdown(planId: string, plan: ReturnType<typeof createRepairPlan>) {
  return [
    `# LoopCI Repair Plan: ${planId}`,
    "",
    `Repository: ${plan.event.repository}`,
    `Workflow: ${plan.event.workflow}`,
    `Run: ${plan.event.runUrl}`,
    `Branch: ${plan.event.branch}`,
    "",
    "## Classification",
    "",
    `- Kind: ${plan.classification.kind}`,
    `- Risk: ${plan.classification.risk}`,
    `- Confidence: ${plan.classification.confidence}`,
    `- Requires human: ${plan.classification.requiresHuman}`,
    "",
    "## Summary",
    "",
    plan.classification.summary,
    "",
    "## Steps",
    "",
    ...plan.steps.map((step) => `- ${step}`),
    "",
    "## Evidence Required",
    "",
    ...plan.evidenceRequired.map((item) => `- ${item}`),
    "",
    "## Residual Risk",
    "",
    plan.residualRisk,
    ""
  ].join("\n");
}

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3] ?? "state/loopci-repair-plan.md";

  if (!inputPath) {
    throw new Error("Usage: npm run diagnose -- <event.json> [output.md]");
  }

  const env = loadEnv();
  const eventPayload = JSON.parse(await readFile(resolve(inputPath), "utf8"));
  const event = ciFailureEventSchema.parse({
    ...eventPayload,
    receivedAt: new Date().toISOString()
  });
  const classifier = createFailureClassifier(env);
  const classification = await classifier.classify(event);
  const plan = createRepairPlan(event, classification);
  const markdown = renderPlanMarkdown(plan.id, plan);
  const resolvedOutputPath = resolve(outputPath);

  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, markdown, "utf8");
  process.stdout.write(`${markdown}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
