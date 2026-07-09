# Credentials Setup

LoopCI keeps secrets out of source code.

Use two local files:

- `.env` for credentials and runtime settings
- `loopci.notifications.json` for routing GitHub actors to Teams, Slack, and email

Do not commit either file when it contains real credentials.

## Local Files

Create the local environment file:

```powershell
Copy-Item .env.example .env
```

Create the notification routing file:

```powershell
Copy-Item loopci.notifications.example.json loopci.notifications.json
```

The orchestrator loads `.env` when started with:

```bash
npm run dev:orchestrator:env
```

The worker loads `.env` when started with:

```bash
npm run dev:worker:env
```

## Where Credentials Are Read

The orchestrator reads runtime credentials from environment variables through `packages/config`.

Ownership can read a repository CODEOWNERS-style file when configured:

```bash
LOOPCI_CODEOWNERS_PATH=./.github/CODEOWNERS
```

If a classified failure contains likely files, LoopCI uses the last matching CODEOWNERS rule first. If no rule matches, it falls back to GitHub triggering actor, actor, then commit author email.

The notification dispatcher reads actor routing from the file path set by:

```bash
LOOPCI_NOTIFICATION_USERS_PATH=./loopci.notifications.json
```

For public deployments, set an internal API token. The dashboard sends this token server-side when reading private orchestrator endpoints.

```bash
LOOPCI_API_TOKEN=<long-random-internal-token>
```

Protected when `LOOPCI_API_TOKEN` is set:

- `GET /plans`
- `GET /plans/:planId`
- `GET /memory`
- `GET /memory/:id`
- `GET /integrations/status`

Do not prefix this value with `NEXT_PUBLIC_`; that would expose it to the browser.

The dashboard reads integration status from:

```text
GET /integrations/status
```

That endpoint reports readiness without exposing webhook URLs, API tokens, SMTP passwords, or email addresses.

## Required By Channel

### GitHub Webhook

```bash
GITHUB_WEBHOOK_SECRET=
LOOPCI_PUBLIC_URL=
LOOPCI_POLICY_PATH=./loopci.config.json
LOOPCI_ALLOW_UNSIGNED_EVENTS=false
```

GitHub sends failed workflow events to:

```text
POST /webhooks/github
```

`POST /events/github-actions/failure` is for local/manual testing. In production it is disabled unless `LOOPCI_ALLOW_UNSIGNED_EVENTS=true` or a valid `Authorization: Bearer <LOOPCI_API_TOKEN>` header is supplied.

### Microsoft Teams

Use either a default Teams webhook:

```bash
LOOPCI_TEAMS_WEBHOOK_URL=
```

or a route in `loopci.notifications.json`:

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

Teams direct messages are not v1. v1 sends channel cards.

### Slack

Use either a default Slack webhook:

```bash
LOOPCI_SLACK_WEBHOOK_URL=
```

or a route in `loopci.notifications.json`:

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

### Email or Gmail

Email needs SMTP plus at least one recipient route or commit-author fallback.

```bash
LOOPCI_EMAIL_FROM=
LOOPCI_SMTP_HOST=smtp.gmail.com
LOOPCI_SMTP_PORT=587
LOOPCI_SMTP_SECURE=false
LOOPCI_SMTP_USER=
LOOPCI_SMTP_PASSWORD=
```

Recipients are configured in `loopci.notifications.json`:

```json
{
  "defaultEmails": ["build-alerts@example.com"],
  "useCommitAuthorEmailFallback": true,
  "users": {
    "github-login": {
      "email": "developer@example.com"
    }
  }
}
```

### Jira

Jira is off until issue creation is enabled.

```bash
LOOPCI_JIRA_CREATE_ISSUES=true
LOOPCI_JIRA_BASE_URL=https://your-company.atlassian.net
LOOPCI_JIRA_EMAIL=
LOOPCI_JIRA_API_TOKEN=
LOOPCI_JIRA_PROJECT_KEY=
LOOPCI_JIRA_ISSUE_TYPE=Bug
```

## Routing Order

For a repair plan, LoopCI uses:

1. CODEOWNERS match from `LOOPCI_CODEOWNERS_PATH`
2. GitHub `triggeringActor`
3. GitHub `actor`
4. matching user route in `loopci.notifications.json`
5. default Teams or Slack webhook
6. configured user email
7. commit author email fallback
8. default alert email

## Verify Setup

After restarting the orchestrator, check:

```bash
curl http://localhost:4000/integrations/status
```

The dashboard at `http://localhost:3000` shows the same status in the Integrations panel.

## Latency

Accepted failure responses include `timingsMs`:

- `policy`
- `classification`
- `memory`
- `planStore`
- `notifications`
- `total`

These are server-side measurements for that request. Localhost latency is not production latency. When Slack, Teams, email, or Jira are enabled, `notifications` can dominate the response time.

Outbound notification calls are bounded by:

```bash
LOOPCI_OUTBOUND_TIMEOUT_MS=5000
```
