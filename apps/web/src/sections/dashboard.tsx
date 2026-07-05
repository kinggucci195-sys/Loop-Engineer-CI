import {
  IoAlertCircleOutline,
  IoArrowForward,
  IoCheckmarkCircleOutline,
  IoCodeSlashOutline,
  IoConstructOutline,
  IoGitBranchOutline,
  IoLogoGithub,
  IoMailUnreadOutline,
  IoNotificationsOutline,
  IoPeopleOutline,
  IoPlayCircleOutline,
  IoShieldCheckmarkOutline,
  IoTimeOutline
} from "react-icons/io5";

const navItems = ["Overview", "Repair queue", "Notifications", "Policy"];

const metrics = [
  {
    label: "Active repair plans",
    value: "12",
    detail: "3 ready for human review",
    tone: "accent",
    icon: IoConstructOutline
  },
  {
    label: "Median diagnosis",
    value: "38s",
    detail: "Webhook to repair card",
    tone: "info",
    icon: IoTimeOutline
  },
  {
    label: "Human gates",
    value: "100%",
    detail: "Merge authority retained",
    tone: "warning",
    icon: IoShieldCheckmarkOutline
  },
  {
    label: "Notification routes",
    value: "3",
    detail: "Slack, Teams, and email",
    tone: "violet",
    icon: IoNotificationsOutline
  }
] as const;

const repairPlans = [
  {
    id: "plan-2002",
    repository: "kinggucci195-sys/loopci",
    branch: "main",
    failure: "workflow-config",
    owner: "kinggucci195-sys",
    channel: "Teams + email",
    risk: "high",
    status: "Human review",
    summary:
      "Workflow failed after a config-level event; PR automation is held."
  },
  {
    id: "plan-3003",
    repository: "billing-api",
    branch: "feature/invoices",
    failure: "lint",
    owner: "maya-dev",
    channel: "Teams",
    risk: "low",
    status: "Fix ready",
    summary: "ESLint rule violation can be repaired with a scoped source patch."
  },
  {
    id: "plan-4421",
    repository: "web-dashboard",
    branch: "release/2026-07",
    failure: "typecheck",
    owner: "devops-lead",
    channel: "Email",
    risk: "low",
    status: "Queued",
    summary: "Type mismatch isolated to one component prop contract."
  }
] as const;

const timeline = [
  {
    title: "Webhook accepted",
    detail: "Signed GitHub workflow_run failure normalized into a CI event.",
    icon: IoLogoGithub
  },
  {
    title: "Actor routed",
    detail: "GitHub user mapped to Teams channel and email fallback.",
    icon: IoPeopleOutline
  },
  {
    title: "Repair card sent",
    detail: "Teams and email include diagnosis, run link, and fix request.",
    icon: IoMailUnreadOutline
  },
  {
    title: "Fix request gated",
    detail: "Only low-risk plans can enter worker handling from the button.",
    icon: IoShieldCheckmarkOutline
  }
] as const;

const policyRows = [
  ["Auto merge", "Off", "All merges stay human-owned"],
  ["Low-risk automation", "Lint, typecheck, unit-test", "Draft repair only"],
  ["Blocked risk", "Medium and high", "Human review required"],
  ["Secrets", "Never patched", "No production secret writes"]
] as const;

function toneClasses(tone: (typeof metrics)[number]["tone"]) {
  const classes = {
    accent:
      "border-[var(--accent)] bg-[oklch(0.23_0.05_151)] text-[var(--accent-strong)]",
    info: "border-[var(--info)] bg-[oklch(0.23_0.04_220)] text-[var(--info)]",
    warning:
      "border-[var(--warning)] bg-[oklch(0.24_0.045_75)] text-[var(--warning)]",
    violet:
      "border-[var(--violet)] bg-[oklch(0.23_0.04_305)] text-[var(--violet)]"
  };

  return classes[tone];
}

function riskClass(risk: (typeof repairPlans)[number]["risk"]) {
  if (risk === "low") {
    return "border-[var(--accent)] text-[var(--accent-strong)]";
  }

  return "border-[var(--danger)] text-[var(--danger)]";
}

/**
 * DashboardShell renders the LoopCI operator view.
 *
 * The first screen prioritizes the repair queue, channel routing, and policy
 * gates that developers need during a failed CI incident.
 */
export function DashboardShell() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto grid min-h-screen w-full max-w-[96rem] grid-cols-1 lg:grid-cols-[16rem_1fr]">
        <aside className="border-b border-[var(--panel-border)] bg-[oklch(0.13_0.01_105)] px-5 py-5 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-4 lg:block">
            <a
              href="/"
              className="flex items-center gap-3 rounded-[8px] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              aria-label="LoopCI overview"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-[var(--accent)] bg-[oklch(0.22_0.05_151)] text-[var(--accent-strong)]">
                <IoCodeSlashOutline className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block text-lg font-semibold">LoopCI</span>
                <span className="block text-sm text-[var(--muted-foreground)]">
                  Incident response
                </span>
              </span>
            </a>
            <span className="rounded-[8px] border border-[var(--panel-border)] px-3 py-2 text-sm text-[var(--muted-foreground)] lg:mt-7 lg:inline-block">
              Safe mode
            </span>
          </div>

          <nav className="mt-6 flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {navItems.map((item, index) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(" ", "-")}`}
                className={`whitespace-nowrap rounded-[8px] px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                  index === 0
                    ? "bg-[var(--panel-raised)] text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--panel)] hover:text-[var(--foreground)]"
                }`}
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="mt-8 hidden rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-4 lg:block">
            <p className="text-sm font-semibold">Current authority</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              LoopCI can diagnose, notify, and queue low-risk repair work.
            </p>
            <p className="mt-4 rounded-[8px] bg-[oklch(0.24_0.045_75)] px-3 py-2 text-sm font-semibold text-[var(--warning)]">
              No auto-merge
            </p>
          </div>
        </aside>

        <section className="min-w-0 px-5 py-5 sm:px-6 lg:px-8">
          <header
            id="overview"
            className="flex flex-col gap-5 border-b border-[var(--panel-border)] pb-5 xl:flex-row xl:items-center xl:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-[var(--accent-strong)]">
                AI incident response for engineering teams
              </p>
              <h1 className="mt-2 text-[clamp(2rem,5vw,4rem)] font-semibold leading-[1]">
                Broken builds become owned repair cards.
              </h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#repair-queue"
                className="inline-flex items-center gap-2 rounded-[8px] bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[oklch(0.12_0.01_105)] transition-colors duration-200 hover:bg-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-[var(--accent-strong)]"
              >
                <IoPlayCircleOutline className="h-5 w-5" aria-hidden />
                Review queue
              </a>
              <a
                href="#notifications"
                className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-sm font-semibold transition-colors duration-200 hover:bg-[var(--panel-raised)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
              >
                <IoNotificationsOutline className="h-5 w-5" aria-hidden />
                Routes
              </a>
            </div>
          </header>

          <MetricGrid />

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
            <RepairQueue />
            <NotificationPanel />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <PipelineTimeline />
            <PolicyPanel />
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricGrid() {
  return (
    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <article
            key={metric.label}
            className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-4"
          >
            <div
              className={`inline-flex h-10 w-10 items-center justify-center rounded-[8px] border ${toneClasses(
                metric.tone
              )}`}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <p className="mt-4 text-sm text-[var(--muted-foreground)]">
              {metric.label}
            </p>
            <p className="mt-1 text-3xl font-semibold">{metric.value}</p>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              {metric.detail}
            </p>
          </article>
        );
      })}
    </section>
  );
}

function RepairQueue() {
  return (
    <section
      id="repair-queue"
      className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)]"
    >
      <div className="flex flex-col gap-3 border-b border-[var(--panel-border)] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Repair queue</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Failed runs ranked by risk, owner, and next action.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-[8px] border border-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-strong)]">
          <IoCheckmarkCircleOutline className="h-5 w-5" aria-hidden />3
          actionable
        </span>
      </div>

      <div className="divide-y divide-[var(--panel-border)]">
        {repairPlans.map((plan) => (
          <article key={plan.id} className="p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-[8px] bg-[var(--panel-raised)] px-3 py-1 text-sm font-semibold">
                    {plan.failure}
                  </span>
                  <span
                    className={`rounded-[8px] border px-3 py-1 text-sm font-semibold ${riskClass(
                      plan.risk
                    )}`}
                  >
                    {plan.risk} risk
                  </span>
                  <span className="rounded-[8px] border border-[var(--panel-border)] px-3 py-1 text-sm text-[var(--muted-foreground)]">
                    {plan.status}
                  </span>
                </div>
                <h3 className="mt-3 truncate text-lg font-semibold">
                  {plan.repository}
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
                  {plan.summary}
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-[var(--muted-foreground)]">
                  <span className="inline-flex items-center gap-2">
                    <IoGitBranchOutline className="h-4 w-4" aria-hidden />
                    {plan.branch}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <IoPeopleOutline className="h-4 w-4" aria-hidden />
                    {plan.owner}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <IoMailUnreadOutline className="h-4 w-4" aria-hidden />
                    {plan.channel}
                  </span>
                </div>
              </div>

              <a
                href={
                  plan.risk === "low"
                    ? `/actions/request-fix?planId=${encodeURIComponent(
                        plan.id
                      )}&risk=${plan.risk}`
                    : "#policy"
                }
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-[8px] px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
                  plan.risk === "low"
                    ? "bg-[var(--accent)] text-[oklch(0.12_0.01_105)] hover:bg-[var(--accent-strong)]"
                    : "border border-[var(--danger)] text-[var(--danger)] hover:bg-[oklch(0.24_0.04_25)]"
                }`}
              >
                {plan.risk === "low" ? "Fix this error" : "Review gate"}
                <IoArrowForward className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function NotificationPanel() {
  return (
    <section
      id="notifications"
      className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Notification routing</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Actor-aware alerts for the person who pushed the change.
          </p>
        </div>
        <IoNotificationsOutline
          className="h-7 w-7 text-[var(--accent-strong)]"
          aria-hidden
        />
      </div>

      <div className="mt-6 space-y-4">
        <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel-raised)] p-4">
          <p className="text-sm font-semibold">Slack card</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            Build failure summary, risk, owner, and fix actions land in the
            engineering channel.
          </p>
        </div>
        <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel-raised)] p-4">
          <p className="text-sm font-semibold">Teams card</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            Diagnosis, GitHub run, and fix request actions land in the team
            channel.
          </p>
        </div>
        <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel-raised)] p-4">
          <p className="text-sm font-semibold">Gmail fallback</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            Commit author email is used when a GitHub login has no explicit
            route.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-[8px] border border-[var(--warning)] bg-[oklch(0.24_0.045_75)] p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--warning)]">
          <IoAlertCircleOutline className="h-5 w-5" aria-hidden />
          Confirmation required
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          Alert buttons open a signed confirmation route before worker handling.
        </p>
      </div>
    </section>
  );
}

function PipelineTimeline() {
  return (
    <section className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-5">
      <h2 className="text-xl font-semibold">Loop stages</h2>
      <div className="mt-5 space-y-4">
        {timeline.map((item) => {
          const Icon = item.icon;

          return (
            <article key={item.title} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel-raised)] text-[var(--accent-strong)]">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                  {item.detail}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PolicyPanel() {
  return (
    <section
      id="policy"
      className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-5"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Repository policy</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Controls that keep CI repair work bounded.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-[8px] border border-[var(--panel-border)] px-3 py-2 text-sm text-[var(--muted-foreground)]">
          <IoShieldCheckmarkOutline className="h-5 w-5" aria-hidden />
          Enforced
        </span>
      </div>

      <div className="mt-5 overflow-hidden rounded-[8px] border border-[var(--panel-border)]">
        <div className="hidden grid-cols-[0.85fr_1fr_1.25fr] border-b border-[var(--panel-border)] bg-[var(--panel-raised)] px-4 py-3 text-sm font-semibold md:grid">
          <span>Control</span>
          <span>Setting</span>
          <span>Result</span>
        </div>
        {policyRows.map(([control, setting, result]) => (
          <div
            key={control}
            className="grid gap-2 border-b border-[var(--panel-border)] px-4 py-4 text-sm last:border-b-0 md:grid-cols-[0.85fr_1fr_1.25fr] md:gap-3"
          >
            <span className="font-semibold">{control}</span>
            <span className="text-[var(--muted-foreground)]">
              <span className="font-semibold text-[var(--foreground)] md:hidden">
                Setting:{" "}
              </span>
              {setting}
            </span>
            <span className="text-[var(--muted-foreground)]">
              <span className="font-semibold text-[var(--foreground)] md:hidden">
                Result:{" "}
              </span>
              {result}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
