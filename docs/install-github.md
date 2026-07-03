# Install LoopCI On A GitHub Repository

LoopCI receives GitHub Actions failure signals, classifies them, and creates a repair plan that stays behind human review.

## 1. Deploy LoopCI

Run the orchestrator behind HTTPS. GitHub webhooks must call a public URL.

```bash
cp .env.example .env
cp loopci.config.example.json loopci.config.json
docker compose -f deploy/docker-compose.production.yml up --build -d
```

Set these values in `.env`:

```bash
LOOPCI_AI_PROVIDER=heuristic
GITHUB_WEBHOOK_SECRET=<long-random-secret>
LOOPCI_PUBLIC_URL=https://your-loopci-domain.example
```

Use `LOOPCI_AI_PROVIDER=openai` only after adding `OPENAI_API_KEY`.

## 2. Configure Repository Policy

Edit `loopci.config.json` and add every repository that can send events:

```json
{
  "repositories": [
    {
      "repository": "owner/repo",
      "allowedBranches": ["main", "release/*"],
      "lowRiskKinds": ["format", "lint", "typecheck", "unit-test"],
      "requireHumanReviewForRisk": ["medium", "high"]
    }
  ]
}
```

LoopCI ignores repositories disabled by policy and ignores branches outside `allowedBranches`.

## 3. Add The GitHub Webhook

In GitHub, open the target repo:

1. Go to `Settings -> Webhooks -> Add webhook`.
2. Payload URL: `https://your-loopci-domain.example/webhooks/github`.
3. Content type: `application/json`.
4. Secret: the same value as `GITHUB_WEBHOOK_SECRET`.
5. Events: select `Workflow runs`.
6. Save and confirm GitHub shows a successful delivery.

LoopCI only accepts signed `workflow_run` events whose conclusion is failed, timed out, cancelled, or action required.

## 4. Verify

```bash
curl https://your-loopci-domain.example/health
curl https://your-loopci-domain.example/ready
curl https://your-loopci-domain.example/plans
```

When a GitHub Actions run fails, `/plans` should show a new repair plan.
