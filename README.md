# LoopCI

LoopCI is an AI-driven CI/CD repair loop. It watches failed pipelines, classifies the failure, filters flaky or noisy failures, prepares a low-risk repair plan, validates evidence, and stops at human review before merge or deploy.

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
