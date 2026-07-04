# LoopCI

LoopCI is an AI-driven CI/CD repair loop. It watches failed pipelines, classifies the failure, filters flaky or noisy failures, prepares a low-risk repair plan, validates evidence, and stops at human review before merge or deploy.

## What It Does

LoopCI gives teams an installable assistant for CI failures:

- Receives signed GitHub `workflow_run` webhooks.
- Applies repository and branch policy before accepting work.
- Classifies failures into lint, typecheck, test, dependency, environment, workflow, secret, flaky, and unknown categories.
- Creates a repair plan with recommended checks, required evidence, residual risk, and a safe review status.
- Lets a worker claim queued low-risk plans and attach evidence bundles.
- Sends Teams and email repair-plan alerts routed by the GitHub actor who triggered the failed run.

It is designed for “advice plus evidence,” not blind auto-merge. The human keeps merge and deployment authority.

## Stack

- npm workspaces
- TypeScript strict mode
- Next.js 16 + React 19 dashboard
- Fastify orchestrator service
- TypeScript worker service
- Jest tests
- ESLint flat config
- Docker Compose for local microservices
- GitHub Actions CI/CD

## Services

```text
apps/web               Next.js dashboard
services/orchestrator  Event ingestion, triage, AI classification
services/worker        Repair-plan worker and evidence bundle builder
packages/contracts     Shared schemas and domain types
packages/config        Environment parsing
packages/logger        Structured logger
```

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

Then add a GitHub webhook for `Workflow runs` pointing to:

```text
https://your-loopci-domain.example/webhooks/github
```

Use the same secret in GitHub and `GITHUB_WEBHOOK_SECRET`.

See:

- [GitHub install guide](docs/install-github.md)
- [Production runbook](docs/production.md)
- [Security model](docs/security.md)

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
- No auto-merge in the MVP.
- No production deploy authority.
- AI output is treated as advice until deterministic checks pass.
- Every repair plan must include evidence and residual risk.
- CI workflow edits require stricter human review than normal source changes.

## Roadmap

1. Observe-only CI failure diagnosis.
2. PR-only low-risk repair plans.
3. Flaky-test registry and rerun policy.
4. Controlled auto-merge for docs/tests/format-only changes.
5. Staging deployment diagnosis.
6. Canary and rollback assistant.
