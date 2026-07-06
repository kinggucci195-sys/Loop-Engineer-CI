import Link from "next/link";
import {
  IoArrowForward,
  IoCheckmarkCircleOutline,
  IoCodeSlashOutline,
  IoGitBranchOutline,
  IoLogoGithub,
  IoMailUnreadOutline,
  IoNotificationsOutline,
  IoPeopleOutline,
  IoShieldCheckmarkOutline,
  IoTrendingUpOutline
} from "react-icons/io5";
import {
  activeIncident,
  caseTimeline,
  getActionablePlanCount,
  policyRows,
  productMetrics,
  repairQueue,
  routeStatuses,
  type PlanState,
  type RiskLevel
} from "./dashboard-model";

const navItems = ["Overview", "Memory", "Queue", "Routes", "Policy"];

const riskClass: Record<RiskLevel, string> = {
  low: "border-[var(--accent)] bg-[oklch(0.96_0.03_155)] text-[var(--accent-strong)]",
  medium:
    "border-[var(--warning)] bg-[oklch(0.96_0.035_75)] text-[oklch(0.48_0.12_75)]",
  high: "border-[var(--danger)] bg-[oklch(0.96_0.03_25)] text-[var(--danger)]"
};

const stateClass: Record<PlanState, string> = {
  ready:
    "border-[var(--accent)] bg-[oklch(0.96_0.03_155)] text-[var(--accent-strong)]",
  queued: "border-[var(--info)] bg-[oklch(0.96_0.025_235)] text-[var(--info)]",
  review:
    "border-[var(--warning)] bg-[oklch(0.96_0.035_75)] text-[oklch(0.48_0.12_75)]"
};

export function DashboardShell() {
  const actionablePlanCount = getActionablePlanCount();

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid min-h-screen lg:grid-cols-[15.5rem_1fr]">
        <SideNav />

        <section className="min-w-0 overflow-x-hidden">
          <TopBar />

          <div className="mx-auto max-w-[92rem] px-4 py-5 sm:px-6 lg:px-8">
            <StatusStrip actionablePlanCount={actionablePlanCount} />

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
              <CurrentIncident />
              <MemorySummary />
            </div>

            <MetricGrid />

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_0.55fr]">
              <RepairQueue />
              <RoutingPanel />
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
              <CaseTimeline />
              <PolicyPanel />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SideNav() {
  return (
    <aside className="border-b border-[var(--panel-border)] bg-[var(--ink)] px-4 py-4 text-white lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-3 lg:block">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-[8px] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          aria-label="LoopCI overview"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--accent)] text-[var(--ink)]">
            <IoCodeSlashOutline className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <span className="block text-base font-semibold">LoopCI</span>
            <span className="block text-xs text-white/60">Build response</span>
          </span>
        </Link>

        <span className="rounded-[8px] border border-white/15 px-2.5 py-1.5 text-xs font-medium text-white/70 lg:mt-7 lg:inline-block">
          Safe mode
        </span>
      </div>

      <nav className="mt-5 flex gap-1.5 overflow-x-auto lg:flex-col lg:overflow-visible">
        {navItems.map((item, index) => (
          <a
            key={item}
            href={`#${item.toLowerCase()}`}
            className={`whitespace-nowrap rounded-[8px] px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${
              index === 0
                ? "bg-[var(--accent)] text-white"
                : "text-white/64 hover:bg-white/10 hover:text-white"
            }`}
          >
            {item}
          </a>
        ))}
      </nav>

      <div className="mt-8 hidden border-t border-white/15 pt-5 lg:block">
        <p className="text-xs font-semibold uppercase text-white/45">
          Authority
        </p>
        <p className="mt-2 text-sm leading-6 text-white/72">
          Draft repairs only. Human approval controls merge and deploy.
        </p>
      </div>
    </aside>
  );
}

function TopBar() {
  return (
    <header
      id="overview"
      className="border-b border-[var(--panel-border)] bg-[var(--panel)]"
    >
      <div className="mx-auto flex max-w-[92rem] flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
            Failed build response
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-[var(--foreground)]">
            CI incident console
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href="#queue"
            className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[var(--accent)] px-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-[var(--info)]"
          >
            <IoArrowForward className="h-4 w-4" aria-hidden />
            Queue
          </a>
          <a
            href="#routes"
            className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] px-3 text-sm font-semibold transition-colors hover:bg-[var(--panel-raised)] focus-visible:outline-2 focus-visible:outline-[var(--info)]"
          >
            <IoNotificationsOutline className="h-4 w-4" aria-hidden />
            Routes
          </a>
        </div>
      </div>
    </header>
  );
}

function StatusStrip({ actionablePlanCount }: { actionablePlanCount: number }) {
  return (
    <section className="grid gap-3 rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-3 md:grid-cols-[1fr_auto_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-[8px] border border-[var(--accent)] bg-[oklch(0.96_0.03_155)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)]">
            {activeIncident.status}
          </span>
          <span className="text-sm font-semibold">
            {activeIncident.repository}
          </span>
        </div>
        <p className="mt-1 truncate text-sm text-[var(--muted-foreground)]">
          {activeIncident.workflow} failed at {activeIncident.failedStep}
        </p>
      </div>

      <span className="font-mono text-sm text-[var(--muted-foreground)]">
        {actionablePlanCount} actionable
      </span>
      <span className="font-mono text-sm text-[var(--muted-foreground)]">
        confidence {activeIncident.recognitionConfidence}
      </span>
    </section>
  );
}

function CurrentIncident() {
  return (
    <section className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)]">
      <div className="border-b border-[var(--panel-border)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
              Current failure
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              {activeIncident.failureKind} in {activeIncident.failedStep}
            </h2>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--muted-foreground)]">
              <span className="inline-flex items-center gap-1.5">
                <IoGitBranchOutline className="h-4 w-4" aria-hidden />
                {activeIncident.branch}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IoLogoGithub className="h-4 w-4" aria-hidden />
                {activeIncident.workflow}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IoPeopleOutline className="h-4 w-4" aria-hidden />
                {activeIncident.likelyOwner}
              </span>
            </div>
          </div>

          <Link
            href={`/actions/request-fix?planId=${encodeURIComponent(
              repairQueue[0]?.id ?? "selected-plan"
            )}&risk=low`}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[8px] bg-[var(--accent)] px-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            <IoCheckmarkCircleOutline className="h-4 w-4" aria-hidden />
            Fix
          </Link>
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-3">
        <FactBlock
          label="Seen before"
          value={`${activeIncident.seenCount} times`}
          detail={`Average resolution ${activeIncident.averageResolution}`}
        />
        <FactBlock
          label="Last fixed by"
          value={activeIncident.lastFixedBy}
          detail={`${activeIncident.repairSuccessRate} repairs worked`}
        />
        <FactBlock
          label="Next action"
          value="Draft PR"
          detail={activeIncident.nextAction}
        />
      </div>
    </section>
  );
}

function FactBlock({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border-t border-[var(--panel-border)] p-5 md:border-r md:last:border-r-0">
      <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
        {detail}
      </p>
    </div>
  );
}

function MemorySummary() {
  return (
    <section
      id="memory"
      className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
            Memory
          </p>
          <h2 className="mt-2 text-xl font-semibold">What worked last time</h2>
        </div>
        <IoTrendingUpOutline
          className="h-6 w-6 text-[var(--accent-strong)]"
          aria-hidden
        />
      </div>

      <p className="mt-5 border-l-2 border-[var(--accent)] pl-4 text-sm leading-6 text-[var(--foreground)]">
        {activeIncident.lastSuccessfulRepair}
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <MemoryDatum label="Owner" value={activeIncident.likelyOwner} />
        <MemoryDatum
          label="Confidence"
          value={activeIncident.recognitionConfidence}
        />
        <MemoryDatum label="Success" value={activeIncident.repairSuccessRate} />
        <MemoryDatum
          label="Resolved in"
          value={activeIncident.averageResolution}
        />
      </dl>
    </section>
  );
}

function MemoryDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel-raised)] p-3">
      <dt className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm font-semibold">{value}</dd>
    </div>
  );
}

function MetricGrid() {
  return (
    <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {productMetrics.map((metric) => (
        <article
          key={metric.label}
          className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-4"
        >
          <p className="text-sm text-[var(--muted-foreground)]">
            {metric.label}
          </p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="font-mono text-3xl font-semibold">{metric.value}</p>
            <span className="rounded-[8px] bg-[var(--panel-raised)] px-2 py-1 text-xs font-semibold text-[var(--accent-strong)]">
              {metric.trend}
            </span>
          </div>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            {metric.detail}
          </p>
        </article>
      ))}
    </section>
  );
}

function RepairQueue() {
  return (
    <section
      id="queue"
      className="min-w-0 rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)]"
    >
      <div className="flex flex-col gap-3 border-b border-[var(--panel-border)] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
            Queue
          </p>
          <h2 className="mt-2 text-xl font-semibold">Repair plans</h2>
        </div>
        <span className="font-mono text-sm text-[var(--muted-foreground)]">
          {getActionablePlanCount()} ready
        </span>
      </div>

      <div className="divide-y divide-[var(--panel-border)] md:hidden">
        {repairQueue.map((plan) => (
          <article key={plan.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold">{plan.id}</p>
                <p className="mt-1 truncate text-sm text-[var(--muted-foreground)]">
                  {plan.repository}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-[8px] border px-2.5 py-1 text-xs font-semibold ${riskClass[plan.risk]}`}
              >
                {plan.risk}
              </span>
            </div>

            <div className="mt-3 grid gap-2 text-sm">
              <p>
                <span className="font-semibold">{plan.failure}</span>
                <span className="text-[var(--muted-foreground)]">
                  {" "}
                  · {plan.owner}
                </span>
              </p>
              <p className="text-[var(--muted-foreground)]">{plan.memory}</p>
              <p className="text-[var(--muted-foreground)]">{plan.route}</p>
            </div>

            <span
              className={`mt-3 inline-flex rounded-[8px] border px-2.5 py-1 text-xs font-semibold ${stateClass[plan.state]}`}
            >
              {plan.nextAction}
            </span>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
          <thead className="bg-[var(--panel-raised)] text-xs uppercase text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Failure</th>
              <th className="px-4 py-3 font-semibold">Memory</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Route</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {repairQueue.map((plan) => (
              <tr
                key={plan.id}
                className="border-t border-[var(--panel-border)]"
              >
                <td className="px-4 py-4 align-top">
                  <p className="font-mono font-semibold">{plan.id}</p>
                  <p className="mt-1 max-w-[13rem] truncate text-[var(--muted-foreground)]">
                    {plan.repository}
                  </p>
                </td>
                <td className="px-4 py-4 align-top">
                  <span
                    className={`inline-flex rounded-[8px] border px-2.5 py-1 text-xs font-semibold ${riskClass[plan.risk]}`}
                  >
                    {plan.risk}
                  </span>
                  <p className="mt-2 font-semibold">{plan.failure}</p>
                </td>
                <td className="px-4 py-4 align-top text-[var(--muted-foreground)]">
                  {plan.memory}
                </td>
                <td className="px-4 py-4 align-top">{plan.owner}</td>
                <td className="px-4 py-4 align-top text-[var(--muted-foreground)]">
                  {plan.route}
                </td>
                <td className="px-4 py-4 align-top">
                  <span
                    className={`inline-flex rounded-[8px] border px-2.5 py-1 text-xs font-semibold ${stateClass[plan.state]}`}
                  >
                    {plan.nextAction}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RoutingPanel() {
  return (
    <section
      id="routes"
      className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
            Routes
          </p>
          <h2 className="mt-2 text-xl font-semibold">Notify the right owner</h2>
        </div>
        <IoMailUnreadOutline
          className="h-6 w-6 text-[var(--info)]"
          aria-hidden
        />
      </div>

      <div className="mt-5 divide-y divide-[var(--panel-border)]">
        {routeStatuses.map((route) => (
          <div
            key={route.channel}
            className="flex items-center justify-between gap-4 py-3"
          >
            <div>
              <p className="font-semibold">{route.channel}</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {route.destination}
              </p>
            </div>
            <span className="rounded-[8px] border border-[var(--panel-border)] px-2.5 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
              {route.status}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CaseTimeline() {
  return (
    <section className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-5">
      <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
        Case timeline
      </p>
      <h2 className="mt-2 text-xl font-semibold">Current case timeline</h2>

      <div className="mt-5 space-y-4">
        {caseTimeline.map(([time, event, detail]) => (
          <div
            key={`${time}-${event}`}
            className="grid grid-cols-[4rem_1fr] gap-3"
          >
            <span className="font-mono text-sm text-[var(--muted-foreground)]">
              {time}
            </span>
            <div className="border-l border-[var(--panel-border)] pl-4">
              <p className="font-mono text-sm font-semibold">{event}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                {detail}
              </p>
            </div>
          </div>
        ))}
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
          <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
            Policy
          </p>
          <h2 className="mt-2 text-xl font-semibold">Safety gates</h2>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-[8px] border border-[var(--panel-border)] px-3 py-2 text-sm font-semibold text-[var(--muted-foreground)]">
          <IoShieldCheckmarkOutline className="h-4 w-4" aria-hidden />
          Enforced
        </span>
      </div>

      <div className="mt-5 overflow-hidden rounded-[8px] border border-[var(--panel-border)]">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-[var(--panel-raised)] text-xs uppercase text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Control</th>
              <th className="px-4 py-3 font-semibold">Setting</th>
              <th className="px-4 py-3 font-semibold">Result</th>
            </tr>
          </thead>
          <tbody>
            {policyRows.map(([control, setting, result]) => (
              <tr
                key={control}
                className="border-t border-[var(--panel-border)]"
              >
                <td className="px-4 py-3 font-semibold">{control}</td>
                <td className="px-4 py-3 text-[var(--muted-foreground)]">
                  {setting}
                </td>
                <td className="px-4 py-3 text-[var(--muted-foreground)]">
                  {result}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
