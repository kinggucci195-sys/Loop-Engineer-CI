# Integrations

LoopCI connects to tools in two directions:

1. Inbound CI events from GitHub Actions.
2. Outbound repair-plan delivery to Slack, Microsoft Teams, email, and Jira.

LoopCI favors boring, reliable integrations: signed GitHub webhooks in, channel webhooks and REST APIs out.

## GitHub Actions

GitHub is the source of truth for failed builds.

Set:

```bash
GITHUB_WEBHOOK_SECRET=<long-random-secret>
```

Then create a GitHub repository webhook:

- Payload URL: `https://your-loopci-domain.example/webhooks/github`
- Content type: `application/json`
- Secret: same value as `GITHUB_WEBHOOK_SECRET`
- Event: `Workflow runs`

LoopCI accepts signed `workflow_run` events whose conclusion is failed, timed out, cancelled, or action required.

## Slack

Slack uses incoming webhook URLs. Create a Slack app, enable incoming webhooks, choose the target channel, and copy the webhook URL.

Default Slack channel:

```bash
LOOPCI_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

Per-user or per-team Slack route:

```json
{
  "defaultSlackWebhookUrl": "https://hooks.slack.com/services/build-alerts",
  "users": {
    "github-login": {
      "slackWebhookUrl": "https://hooks.slack.com/services/developer-channel"
    }
  }
}
```

Use the default channel for early setup. Use per-user routes when you know which GitHub actors should map to which team channels.

## Microsoft Teams

Teams uses incoming webhook or workflow URLs for channel notifications. Create the webhook/workflow in the target Teams channel and copy the URL.

Default Teams channel:

```bash
LOOPCI_TEAMS_WEBHOOK_URL=https://example.webhook.office.com/webhookb2/...
```

Per-user or per-team Teams route:

```json
{
  "defaultTeamsWebhookUrl": "https://example.webhook.office.com/webhookb2/build-alerts",
  "users": {
    "github-login": {
      "teamsWebhookUrl": "https://example.webhook.office.com/webhookb2/developer-channel"
    }
  }
}
```

Direct Teams DMs require a Teams bot and user ID mapping. LoopCI intentionally starts with channel cards.

## Email

Email is the fallback route when chat is not available or a GitHub actor has no explicit channel mapping.

```bash
LOOPCI_EMAIL_FROM=loopci@example.com
LOOPCI_SMTP_HOST=smtp.gmail.com
LOOPCI_SMTP_PORT=587
LOOPCI_SMTP_SECURE=false
LOOPCI_SMTP_USER=loopci@example.com
LOOPCI_SMTP_PASSWORD=<smtp-secret-or-gmail-app-password>
```

If `useCommitAuthorEmailFallback` is true, LoopCI sends to the commit author email when no actor mapping exists.

## Jira

Jira issue creation is disabled by default. Turn it on when you want repair plans to become trackable tickets.

```bash
LOOPCI_JIRA_CREATE_ISSUES=true
LOOPCI_JIRA_BASE_URL=https://your-company.atlassian.net
LOOPCI_JIRA_EMAIL=loopci@example.com
LOOPCI_JIRA_API_TOKEN=<jira-api-token>
LOOPCI_JIRA_PROJECT_KEY=ENG
LOOPCI_JIRA_ISSUE_TYPE=Bug
```

LoopCI creates issues through Jira Cloud REST API v3. The issue includes:

- Repository, branch, workflow, and GitHub run.
- Triggering actor or commit author signal.
- Failure kind, risk, and confidence.
- Recommended checks and residual risk.
- Links to the LoopCI diagnosis and safe fix-request route.

Recommended rollout:

1. Start with Slack or Teams only.
2. Enable Jira issue creation for protected branches or shared repositories.
3. Later, add deduplication so repeated failures update an existing issue instead of creating a new one.

## Routing File

Use `LOOPCI_NOTIFICATION_USERS_PATH` to point at `loopci.notifications.json`.

Example:

```json
{
  "defaultEmails": ["build-alerts@example.com"],
  "defaultSlackWebhookUrl": "https://hooks.slack.com/services/build-alerts",
  "defaultTeamsWebhookUrl": "https://example.webhook.office.com/webhookb2/build-alerts",
  "useCommitAuthorEmailFallback": true,
  "users": {
    "github-login": {
      "displayName": "Example Developer",
      "email": "developer@example.com",
      "slackWebhookUrl": "https://hooks.slack.com/services/developer-channel",
      "teamsWebhookUrl": "https://example.webhook.office.com/webhookb2/developer-channel"
    }
  }
}
```

Routing priority:

1. Per-user Slack or Teams webhook.
2. Default Slack or Teams webhook.
3. Per-user email.
4. Commit author email fallback.
5. Default alert email.

## Status API

The dashboard reads `GET /integrations/status` from the orchestrator. This endpoint reports whether each outbound route can send without exposing webhook URLs, tokens, email addresses, or SMTP credentials.

It returns:

- whether notifications are globally enabled
- whether the routing file path is set and loaded
- how many actor routes are configured
- Teams and Slack route source: environment, routing file, per-user route, or none
- email readiness: SMTP configured plus recipient route or commit-author fallback
- Jira readiness: issue creation enabled plus required Jira settings present

The dashboard should treat this endpoint as the source of truth. It must not show Slack, Teams, email, or Jira as connected unless the orchestrator reports them as configured.

For local credential setup, see [Credentials Setup](./credentials-setup.md).

## Product Direction

Slack, Teams, email, and Jira are not the moat by themselves. They are the delivery layer.

The product value is the loop around them:

- Policy decides what is safe.
- Ownership decides who sees it.
- Evidence decides whether a fix is reviewable.
- History decides whether this is a repeated failure.
- Human approval decides whether code changes.
