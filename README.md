# LoopCI

LoopCI is AI incident response for engineering teams.

When CI fails, LoopCI turns the red build into an owned, evidence-backed repair card: what failed, why it likely failed, who should see it, how risky it is, and what action is safe next.

It is not trying to be another chat box for pasted logs. It is the coordination layer around broken builds.

## Why Not Just Paste Logs Into ChatGPT?

Because engineering teams need more than a one-off answer.

LoopCI is built to:

- Detect failed pipelines automatically.
- Identify the likely owner from GitHub actor and commit context.
- Separate low-risk failures from risky workflow, dependency, secret, or environment failures.
- Send the right repair card to Teams or email.
- Preserve evidence, recommended checks, and residual risk.
- Keep merge and deploy authority behind human approval.

ChatGPT can explain a log. LoopCI helps a team run the response.

## What Happens When CI Fails

```text
GitHub Actions fails
-> LoopCI receives a signed workflow_run webhook
-> Repository policy checks branch, repo, and allowed failure classes
-> Failure is classified by kind, confidence, and risk
-> A repair plan is created with evidence and recommended checks
-> The triggering developer or default team channel is notified
-> Low-risk fixes can be queued for worker handling
-> Risky changes stay behind human review
```

## Current Capabilities

- Signed GitHub Actions webhook ingestion.
- Repository and branch policy enforcement.
- Failure classification for format, lint, typecheck, tests, dependencies, environment, workflow config, secrets, flaky/noisy failures, and unknown failures.
- Repair plans with evidence requirements, recommended checks, residual risk, and review status.
- Teams Adaptive Card and Slack Block Kit notifications with diagnosis, GitHub run, and fix-request links.
- SMTP/Gmail-compatible email notifications.
- GitHub actor to notification target routing through `loopci.notifications.json`.
- Safe request-fix checkpoint for low-risk plans.
- Worker evidence bundle generation.
- Dashboard for repair queue, notification routing, and policy posture.

## Positioning

LoopCI should be evaluated against engineering incident tools, not coding assistants.

It coordinates the response to broken builds:

- Who owns the failure?
- Has this happened before?
- Is it flaky or real?
- Is it safe to request a repair?
- What evidence must a reviewer see before merge?
- Which channel should get the alert?

Generic AI assistants help an individual reason about code. LoopCI helps a team operationalize CI failure response.

## Services

```text
apps/web               Next.js dashboard
services/orchestrator  Event ingestion, triage, AI classification
services/worker        Repair-plan worker and evidence bundle builder
packages/contracts     Shared schemas and domain types
packages/config        Environment parsing
packages/logger        Structured logger
```

## Stack

- npm workspaces
- TypeScript strict mode
- Next.js 16 + React 19 dashboard
- Tailwind CSS dashboard UI
- Fastify orchestrator service
- TypeScript worker service
- Jest tests
- ESLint flat config
- Docker Compose for local microservices
- GitHub Actions CI/CD

## Local Development

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Run the services:

```bash
npm run dev
```

Or with Docker:

```bash
docker compose up --build
```

## Production Install

```bash
cp .env.example .env
cp loopci.config.example.json loopci.config.json
cp loopci.notifications.example.json loopci.notifications.json
docker compose -f deploy/docker-compose.production.yml up --build -d
```

## Dashboard Deployment

The public dashboard is deployed from `apps/web` as a standalone Next.js app:

```bash
cd apps/web
npx vercel deploy . --project web --prod --force --logs --yes
```

Current public URL:

```text
https://loopci.vercel.app
```

Do not deploy the repository root to the old Vercel Services project. The dashboard build expects the `apps/web` project root.

Then add a GitHub webhook for `Workflow runs` pointing to:

```text
https://your-loopci-domain.example/webhooks/github
```

Use the same secret in GitHub and `GITHUB_WEBHOOK_SECRET`.

See:

- [GitHub install guide](docs/install-github.md)
- [Production runbook](docs/production.md)
- [Security model](docs/security.md)
- [Product positioning](docs/product-positioning.md)
- [Product execution plan](docs/product-plan.md)

## Example CI Failure Event

```bash
curl -X POST http://localhost:4000/events/github-actions/failure \
  -H "content-type: application/json" \
  -d '{
    "provider": "github-actions",
    "repository": "kinggucci195-sys/example",
    "workflow": "ci",
    "runId": "123",
    "runUrl": "https://github.com/kinggucci195-sys/example/actions/runs/123",
    "commitSha": "abc123",
    "branch": "feature/test",
    "failedJob": "test",
    "failedStep": "npm test",
    "logExcerpt": "Expected true to be false at src/app.test.ts:12"
  }'
```

## Safety Model

- GitHub webhooks must be signed with `X-Hub-Signature-256`.
- Repository policy controls accepted repos, branches, risk levels, and failure kinds.
- AI never merges code without approval.
- No production deploy authority in the MVP.
- AI output is treated as advice until deterministic checks pass.
- Every repair plan must include evidence and residual risk.
- CI workflow edits require stricter human review than normal source changes.

## Roadmap

1. GitHub PR comments with root cause, confidence, evidence, and suggested fix.
2. Jira and Linear ticket creation from repair plans.
3. Ownership routing using commit history, CODEOWNERS, and `git blame`.
4. Flaky-test registry and historical failure memory.
5. Weekly engineering health reports.
6. PagerDuty incident creation for protected branch failures.
7. GitHub App repair PR creation for low-risk fixes.
8. Approval workflows, audit logs, SSO, and enterprise retention controls.
