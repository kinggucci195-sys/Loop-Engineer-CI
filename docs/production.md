# Production Runbook

## Runtime

LoopCI is split into two services:

- `orchestrator`: HTTP ingestion, policy checks, classification, repair-plan storage.
- `worker`: claims queued plans and writes evidence bundles.

Both services share `STATE_DIR`, currently a mounted JSONL-backed state volume. This is simple and inspectable for an MVP; move the store to Postgres before high-concurrency or multi-region use.

## Dashboard Hosting

The dashboard is a separate Next.js app in `apps/web` and is currently hosted on Vercel at:

```text
https://loopci.vercel.app
```

Deploy it from the app directory, not the repository root:

```bash
cd apps/web
npx vercel deploy . --project web --prod --force --logs --yes
```

The root repository is for the full monorepo and Docker services. Keep Vercel dashboard deploys scoped to `apps/web` so the build uses the app-local `vercel.json`, `postcss.config.mjs`, and `tsconfig.json`.

## Required Secrets

- `GITHUB_WEBHOOK_SECRET`: verifies GitHub webhook delivery signatures.
- `OPENAI_API_KEY`: required only when `LOOPCI_AI_PROVIDER=openai`.
- `GITHUB_TOKEN`: reserved for future authenticated GitHub API actions.
- `LOOPCI_TEAMS_WEBHOOK_URL`: optional Teams channel webhook for repair-plan alerts.
- `LOOPCI_SLACK_WEBHOOK_URL`: optional Slack incoming webhook for repair-plan alerts.
- `LOOPCI_JIRA_API_TOKEN`: optional Jira Cloud API token for creating repair-plan issues.
- `LOOPCI_SMTP_PASSWORD`: optional SMTP or Gmail app password for email alerts.
- `LOOPCI_API_TOKEN`: internal token for dashboard-to-orchestrator reads.
- `LOOPCI_ALLOW_UNSIGNED_EVENTS=false`: keep unsigned manual event ingestion disabled in production.
- `LOOPCI_OUTBOUND_TIMEOUT_MS=5000`: caps Slack, Teams, SMTP, and Jira delivery waits.

Never commit `.env`, raw CI logs, private keys, tokens, or generated evidence that contains secrets.

## Network

Expose only the orchestrator through HTTPS. Keep the worker private. Recommended public endpoints:

- `GET /health`: liveness.
- `GET /ready`: readiness, including state-store access.
- `GET /plans/:planId`: repair-plan detail for alert links.
- `GET /actions/plans/:planId/request-fix`: safe confirmation page for alert buttons.
- `POST /webhooks/github`: signed webhook ingestion.
- `POST /actions/plans/:planId/request-fix`: queues a low-risk plan for worker evidence.

Use a reverse proxy, managed load balancer, or platform router that enforces TLS and request size limits.

## Notifications

LoopCI can notify Slack, a Teams channel, and email recipients when a repair plan is created.

- Use `LOOPCI_NOTIFICATION_USERS_PATH` to point at `loopci.notifications.json`.
- Map GitHub logins to email addresses, Slack webhooks, and Teams webhooks in that file.
- Use `LOOPCI_SLACK_WEBHOOK_URL` for a default Slack channel, or `defaultSlackWebhookUrl` in the notification file.
- Use `LOOPCI_TEAMS_WEBHOOK_URL` for a default Teams channel, or `defaultTeamsWebhookUrl` in the notification file.
- Use Gmail SMTP, Google Workspace SMTP relay, or another SMTP provider for email delivery.

The Slack, Teams, and email buttons open a confirmation URL. They do not merge code or deploy production changes directly.

## Jira Issues

LoopCI can create Jira issues when a repair plan is created. Jira issue creation is disabled by default so local demos and production installs do not create tickets unexpectedly.

Required values:

- `LOOPCI_JIRA_CREATE_ISSUES=true`
- `LOOPCI_JIRA_BASE_URL=https://your-company.atlassian.net`
- `LOOPCI_JIRA_EMAIL=loopci@example.com`
- `LOOPCI_JIRA_API_TOKEN=<jira-api-token>`
- `LOOPCI_JIRA_PROJECT_KEY=<project-key>`
- `LOOPCI_JIRA_ISSUE_TYPE=Bug`

The Jira issue contains the repository, branch, workflow, owner signal, risk, confidence, recommended checks, residual risk, diagnosis link, fix-request link, and GitHub run link.

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
