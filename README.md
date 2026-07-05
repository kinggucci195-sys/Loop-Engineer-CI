# LoopCI

Every failed CI build costs engineering time.

LoopCI turns failed GitHub Actions runs into owned repair plans with evidence, risk analysis, and human-approved next steps.

Instead of digging through logs, your team receives exactly what failed, why it failed, who owns it, and what to do next.

We're not another chatbot for CI logs. We coordinate the response.

AI never merges code without approval.

![LoopCI dashboard showing failed builds ranked by owner, risk, route, and next action](docs/assets/loopci-dashboard.png)

## How It Works

```text
CI fails
-> LoopCI receives the signed GitHub webhook
-> LoopCI analyzes the failure
-> LoopCI identifies the likely owner or fallback channel
-> LoopCI builds an evidence-backed repair plan
-> LoopCI notifies the right engineer in Slack, Teams, or email
-> Humans approve risky changes
```

LoopCI should be evaluated against engineering incident tools, not coding assistants.

GitHub Copilot, Cursor, Claude Code, and ChatGPT help an individual reason about code. LoopCI helps a team operationalize the response to broken builds.

## Who It Is For

LoopCI is for engineering teams that use GitHub Actions and lose time when builds fail without a clear owner or safe next step.

Best early users:

- Platform and DevOps teams responsible for build health.
- Engineering managers who need failed builds assigned and tracked.
- Startup teams that live in GitHub, Slack, Teams, or email.
- Regulated teams where AI assistance must stay behind human approval.

Not the target user: a solo developer who only wants to paste one log into a chatbot.

## Today LoopCI Supports

- GitHub Actions failure webhooks.
- Repository and branch policy enforcement.
- Repair plans with summary, likely owner, risk, confidence, evidence, and next action.
- Slack repair cards.
- Microsoft Teams repair cards.
- SMTP and Gmail-compatible email notifications.
- Actor-aware routing through `loopci.notifications.json`.
- A dashboard for failed builds ranked by risk, owner, route, and review state.
- A safe "Fix this error" confirmation route for low-risk repair work.

## What LoopCI Sends

Each repair card answers the questions engineers ask first:

- What failed?
- Why did it likely fail?
- Who owns it?
- Is this low-risk or review-gated?
- What evidence should a reviewer see?
- What action is safe next?

## How LoopCI Decides

LoopCI does not treat every failure as an AI free-for-all.

The current decision path is:

1. Verify the GitHub webhook signature.
2. Normalize the workflow failure into a CI event.
3. Apply repository policy for repo, branch, risk, and allowed failure classes.
4. Classify the failure using deterministic heuristics first.
5. Attach confidence, recommended checks, required evidence, and residual risk.
6. Route the plan using GitHub actor, commit author email, and configured chat/email targets.
7. Keep medium-risk and high-risk plans behind human review.

Optional OpenAI classification can be enabled, but policy and deterministic checks remain the authority.

## Trust Model

- No auto-merge in the MVP.
- No production deploy authority.
- No production secrets in patch sandboxes.
- CI workflow edits require stricter human review.
- Every repair plan must include evidence and residual risk.
- Unsafe or unknown failures stay behind a review gate.

## Coming Next

- GitHub PR comments with root cause, confidence, evidence, and suggested next action.
- GitHub App authentication for richer run context and draft repair branches.
- Jira issue creation from repair plans.
- Historical failure memory for repeated failures and flaky tests.

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

More setup docs:

- [GitHub install guide](docs/install-github.md)
- [Production runbook](docs/production.md)
- [Security model](docs/security.md)
- [Product positioning](docs/product-positioning.md)
- [Product execution plan](docs/product-plan.md)

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

## Services

```text
apps/web               Next.js dashboard
services/orchestrator  Event ingestion, triage, classification, notification routing
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
