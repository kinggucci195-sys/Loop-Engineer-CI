# Production Runbook

## Runtime

LoopCI is split into two services:

- `orchestrator`: HTTP ingestion, policy checks, classification, repair-plan storage.
- `worker`: claims queued plans and writes evidence bundles.

Both services share `STATE_DIR`, currently a mounted JSONL-backed state volume. This is simple and inspectable for an MVP; move the store to Postgres before high-concurrency or multi-region use.

## Required Secrets

- `GITHUB_WEBHOOK_SECRET`: verifies GitHub webhook delivery signatures.
- `OPENAI_API_KEY`: required only when `LOOPCI_AI_PROVIDER=openai`.
- `GITHUB_TOKEN`: reserved for future authenticated GitHub API actions.

Never commit `.env`, raw CI logs, private keys, tokens, or generated evidence that contains secrets.

## Network

Expose only the orchestrator through HTTPS. Keep the worker private. Recommended public endpoints:

- `GET /health`: liveness.
- `GET /ready`: readiness, including state-store access.
- `POST /webhooks/github`: signed webhook ingestion.

Use a reverse proxy, managed load balancer, or platform router that enforces TLS and request size limits.

## Safe Operating Mode

LoopCI does not auto-merge or deploy. It produces plans and evidence for humans. Repository policy can force human review by failure kind, risk level, or branch.

Recommended starting policy:

- Allow only `main`, `develop`, and `release/*`.
- Treat `format`, `lint`, `typecheck`, and `unit-test` as low-risk.
- Require human review for dependency, environment, workflow, secret, permission, and unknown failures.
- Keep `autoCreateIssue` and `autoCommentOnPr` disabled until GitHub App permissions are implemented.

## Upgrade Path

Before broader adoption:

1. Replace JSONL storage with Postgres and row-level claiming.
2. Add GitHub App authentication for fetching job logs and creating PR comments.
3. Add per-tenant API keys or GitHub App installation checks.
4. Add OpenTelemetry traces and metrics for webhook volume, classification latency, plan queue age, and worker outcomes.
5. Add backup and retention policies for plan and evidence data.
