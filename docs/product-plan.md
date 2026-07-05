# Product Execution Plan

This plan turns the product critique into engineering work. The goal is to make LoopCI useful as the operational layer between a failed build and a safe fix, not just a log explainer.

## Product Thesis

Engineering teams do not only need a CI failure summary. They need the failure routed, owned, risk-scored, tracked, and resolved without losing control of merge and deploy authority.

The product should be understood in ten seconds:

> Every failed CI build costs engineering time. LoopCI turns failed GitHub Actions runs into owned repair plans with evidence, risk analysis, and human-approved next steps.

LoopCI wins by coordinating the response around failed pipelines:

- Detect the failure automatically.
- Explain the likely cause in plain engineering language.
- Identify the owner or fallback channel.
- Show risk and confidence before any action.
- Put the repair card where the team already works.
- Keep unsafe actions behind human review.

## Phase 1: Incident Cards

Deliver a useful notification within seconds of a failed run.

- GitHub signed webhook ingestion.
- Repository policy checks.
- Failure classification and risk.
- Repair plans with evidence requirements.
- Slack repair cards.
- Teams repair cards.
- Email repair messages.
- "Fix this error" confirmation route for low-risk plans.

Success metric: an engineer can understand who owns the failure, why it failed, and what action is safe without opening raw CI logs first.

README proof points:

- Show the dashboard screenshot before architecture.
- Explain the simple loop before listing capabilities.
- Keep stack and install details below the product story.
- Avoid long roadmaps that look like generic AI startup promises.

## Phase 2: GitHub-Native Response

Make LoopCI visible where CI already happens.

- Comment on failed PRs with root cause, confidence, evidence, and next action.
- Link the PR comment to the repair card.
- Add repo policy labels such as `loopci:low-risk` and `loopci:human-review`.
- Store the GitHub check/run/job IDs needed to avoid duplicate comments.

Success metric: the PR page explains the failure better than the raw Actions UI.

## Phase 3: Ownership Routing

Route failures to the person or team most likely to fix them.

- Read CODEOWNERS.
- Use commit author and triggering actor as initial signals.
- Add optional `git blame` ownership for likely files.
- Support team aliases in `loopci.notifications.json`.
- Record why an owner was selected.

Success metric: fewer failed builds land in a generic alerts channel with no owner.

## Phase 4: Historical Intelligence

Use memory to reduce repeated diagnosis work.

- Store failure fingerprints by repo, workflow, job, step, and normalized error.
- Detect repeated failures and flaky tests.
- Show "seen before" count on repair cards.
- Recommend proven fixes when prior evidence exists.
- Produce weekly build health reports.

Success metric: recurring failures get faster, more confident responses over time.

## Phase 5: Ticket And Incident Systems

Escalate build failures into the systems companies already use.

- Jira ticket creation from repair plans.
- Linear issue creation from repair plans.
- PagerDuty incident creation for protected branch or release branch failures.
- Status transitions when GitHub checks recover.

Success metric: managers can track build failures without asking engineers for manual status updates.

## Phase 6: Controlled Repair Automation

Only automate when policy says it is low-risk.

- GitHub App authentication.
- Draft repair branches for format, lint, typecheck, and isolated unit-test failures.
- Required deterministic checks before marking a plan ready.
- Human approval before merge.
- Audit log for every action.

Success metric: LoopCI reduces toil without silently changing production code.

## Not The Product

Do not build toward these claims:

- "Paste logs here and get an answer."
- "AI merges code for you."
- "A dashboard that only lists failed jobs."
- "A generic DevOps chatbot."

The product is incident response for engineering teams.
