# Security Model

LoopCI treats CI logs, webhook payloads, and AI output as untrusted input.

## Trust Boundaries

- GitHub webhook ingress is public and must pass `X-Hub-Signature-256` validation.
- Repository policy decides which repos and branches are accepted.
- AI classification cannot merge, deploy, write secrets, or bypass human review.
- Worker evidence is advisory until a maintainer reviews it.

## Defaults

- Unsigned GitHub webhooks return `401`.
- Unsupported GitHub events return `202` and are ignored.
- Branches outside policy return `202` and are ignored.
- Medium and high risk classifications require human review.
- Workflow, dependency, environment, secret, permission, and unknown failures require human review.

## Secret Handling

LoopCI stores only trimmed failure context. Keep `maxLogExcerptChars` low enough for your organization, and redact logs before forwarding from CI workflows. Do not send full raw logs unless you have a retention and access-control story.

## Current Limitations

The MVP uses a JSONL state store. That is acceptable for a single-node demo or small internal deployment, but production teams should move state to Postgres before running multiple workers or accepting high webhook volume.
