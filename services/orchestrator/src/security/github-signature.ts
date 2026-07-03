import { createHmac, timingSafeEqual } from "node:crypto";

const signaturePrefix = "sha256=";

export function signGitHubWebhookBody(rawBody: string, secret: string): string {
  return `${signaturePrefix}${createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex")}`;
}

export function verifyGitHubWebhookSignature(
  rawBody: string | Buffer | undefined,
  signatureHeader: string | string[] | undefined,
  secret: string | undefined
): boolean {
  if (!rawBody || !secret || !signatureHeader) {
    return false;
  }

  const candidate = Array.isArray(signatureHeader)
    ? signatureHeader[0]
    : signatureHeader;

  if (!candidate?.startsWith(signaturePrefix)) {
    return false;
  }

  const expected = signGitHubWebhookBody(String(rawBody), secret);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const candidateBuffer = Buffer.from(candidate, "utf8");

  return (
    expectedBuffer.length === candidateBuffer.length &&
    timingSafeEqual(expectedBuffer, candidateBuffer)
  );
}
