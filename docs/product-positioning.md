# Product Positioning

## Category

LoopCI is AI incident response for engineering teams.

It should not be positioned as a generic AI coding assistant or "AI that fixes CI." That puts it in the same mental bucket as Copilot, Cursor, Claude Code, Devin, and ChatGPT.

LoopCI is closer to PagerDuty, FireHydrant, Linear, Jira Automation, Datadog Incident Response, and Opsgenie, but focused on software delivery failures.

## One-Line Pitch

LoopCI turns failed pipelines into owned, evidence-backed repair cards across GitHub, Slack, Teams, and email.

## Short Pitch

When CI fails, teams lose time reading logs, guessing owners, rerunning flaky jobs, and deciding whether a fix is safe. LoopCI detects failed pipelines, identifies the likely owner, separates low-risk failures from risky ones, sends the right repair card to the right channel, and keeps merge authority behind human approval.

## Why It Is Different From ChatGPT

ChatGPT can explain a pasted log.

LoopCI runs the response process:

- It receives the failure automatically.
- It applies repository policy.
- It preserves evidence and risk.
- It routes the alert to the right person or channel.
- It creates a durable repair plan.
- It can later open tickets, PR comments, and low-risk repair PRs.

That makes LoopCI operational software, not just a prompt.

## Ideal Customer Profile

Best early customers:

- Teams using GitHub Actions heavily.
- Teams with frequent flaky tests or noisy CI failures.
- Engineering orgs with release branches, protected branches, or compliance expectations.
- Agencies or platform teams managing many repositories.
- Teams already living in Slack, Teams, Jira, Linear, or PagerDuty.

Avoid starting with buyers who only want autonomous code generation. LoopCI's wedge is coordination and trust.

## Primary Buyer

- VP of Engineering
- Engineering Manager
- Platform Engineering Lead
- DevOps Lead
- Staff Engineer responsible for build health

## Core Jobs To Be Done

- Know why CI failed without reading raw logs.
- Know who should own the failure.
- Know whether it is flaky or real.
- Know whether the next action is safe.
- Give reviewers evidence before any code is changed.
- Track repeated failures and recurring repair patterns.
- Reduce time wasted on broken builds.

## Messaging Pillars

### 1. Own The Failure

LoopCI routes failed builds to the developer, team, or channel most likely to resolve them.

### 2. Explain The Risk

LoopCI separates low-risk lint/type/test issues from workflow, dependency, secret, and environment failures that need human review.

### 3. Preserve Evidence

Every repair plan includes the failure summary, recommended checks, residual risk, and evidence requirements.

### 4. Meet Teams Where They Work

GitHub, Teams, email today. Slack, Jira, Linear, and PagerDuty next.

### 5. Human Approval By Design

LoopCI is designed for teams where AI should assist, not silently merge or deploy.

## Product Roadmap

### Now

- GitHub Actions webhook ingestion.
- Policy-gated failure classification.
- Repair plans and evidence bundles.
- Slack, Teams, and email notifications.
- Dashboard for queue and policy posture.

### Next

- GitHub PR comments with root cause, confidence, and suggested fix.
- Jira and Linear ticket creation.
- CODEOWNERS and `git blame` ownership routing.
- Historical failure memory.
- Flaky-test registry.

### Later

- PagerDuty incidents for protected branch failures.
- Weekly engineering health reports.
- GitHub App draft repair PRs for low-risk failures.
- SSO, audit logs, retention policies, and enterprise approvals.
- Self-hosted and private deployment packages.

## Pricing Direction

Early packaging can be simple:

- Starter: free for one repo.
- Team: monthly price for multiple repos and chat/email routing.
- Business: ownership routing, tickets, reports, and protected branch policies.
- Enterprise: SSO, audit logs, private deployment, custom retention, and dedicated support.

## Anti-Positioning

Do not lead with:

- "AI-driven CI/CD repair loop"
- "Classifies failures"
- "Creates repair plans"
- "Uses Next.js, Fastify, and npm workspaces"

Lead with:

- "AI incident response for engineering teams"
- "Turns failed pipelines into owned repair cards"
- "Routes CI failures to the right engineer with evidence"
- "Keeps AI-assisted repair behind policy and human approval"
