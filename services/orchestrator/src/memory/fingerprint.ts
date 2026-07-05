import { createHash } from "node:crypto";
import type { CiFailureEvent, FailureClassification } from "@loopci/contracts";
import type { FailureFingerprint } from "@loopci/contracts";

export function createFailureFingerprint(
  event: CiFailureEvent,
  classification: FailureClassification
): FailureFingerprint {
  const likelyFiles = [...classification.likelyFiles].sort();
  const normalizedSignature = normalizeLogSignature(event.logExcerpt);
  const signature = [
    event.repository,
    event.workflow,
    event.failedJob,
    event.failedStep,
    classification.kind,
    normalizedSignature,
    likelyFiles.join(",")
  ].join("|");

  return {
    id: `fp-${hash(signature)}`,
    type: "ci-failure",
    signature,
    repository: event.repository,
    workflow: event.workflow,
    job: event.failedJob,
    step: event.failedStep,
    kind: classification.kind,
    normalizedSignature,
    likelyFiles
  };
}

export function normalizeLogSignature(logExcerpt: string): string {
  return logExcerpt
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/\b[0-9a-f]{7,40}\b/g, "<sha>")
    .replace(
      /\b\d{4}-\d{2}-\d{2}[t\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?z?\b/g,
      "<timestamp>"
    )
    .replace(/\b\d{1,2}:\d{2}:\d{2}\b/g, "<timestamp>")
    .replace(/\brun(?:ner)?[-_\s]?\d+\b/g, "run-<id>")
    .replace(/\b\d+:\d+\b/g, "<line-column>")
    .replace(/\bline\s+\d+\b/g, "line <n>")
    .replace(/\bcol(?:umn)?\s+\d+\b/g, "column <n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}
