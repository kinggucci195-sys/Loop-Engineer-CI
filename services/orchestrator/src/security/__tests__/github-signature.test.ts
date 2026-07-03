import {
  signGitHubWebhookBody,
  verifyGitHubWebhookSignature
} from "../github-signature";

describe("GitHub webhook signatures", () => {
  it("accepts a valid sha256 signature", () => {
    const rawBody = JSON.stringify({ ok: true });
    const signature = signGitHubWebhookBody(rawBody, "secret");

    expect(
      verifyGitHubWebhookSignature(rawBody, signature, "secret")
    ).toBeTruthy();
  });

  it("rejects missing secrets and invalid signatures", () => {
    const rawBody = JSON.stringify({ ok: true });
    const signature = signGitHubWebhookBody(rawBody, "secret");

    expect(verifyGitHubWebhookSignature(rawBody, signature, undefined)).toBe(
      false
    );
    expect(verifyGitHubWebhookSignature(rawBody, "sha256=bad", "secret")).toBe(
      false
    );
  });
});
