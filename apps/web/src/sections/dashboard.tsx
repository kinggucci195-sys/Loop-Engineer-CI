import Link from "next/link";
import {
  IoAlertCircleOutline,
  IoArrowForward,
  IoCheckmarkCircleOutline,
  IoCodeSlashOutline,
  IoGitBranchOutline,
  IoLogoGithub,
  IoPulseOutline,
  IoRadioButtonOffOutline,
  IoShieldCheckmarkOutline
} from "react-icons/io5";
import {
  findMemoryForPlan,
  formatConfidence,
  getCurrentPlan,
  getDashboardMetrics,
  loadDashboardState,
  type DashboardIntegrationChannel,
  type DashboardMemoryRecord,
  type DashboardPlan,
  type DashboardState
} from "./dashboard-model";

const navItems = ["Overview", "Plans", "Memory", "Integrations", "Policy"];

const riskClass: Record<DashboardPlan["risk"], string> = {
  low: "border-[var(--accent)] bg-[var(--accent-surface)] text-[var(--accent-strong)]",
  medium:
    "border-[var(--warning)] bg-[var(--warning-surface)] text-[var(--warning-strong)]",
  high: "border-[var(--danger)] bg-[var(--danger-surface)] text-[var(--danger)]"
};

export async function DashboardShell() {
  const state = await loadDashboardState();
  const currentPlan = getCurrentPlan(state.plans);
  const currentMemory = findMemoryForPlan(currentPlan, state.memory);

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid min-h-screen lg:grid-cols-[15.5rem_1fr]">
        <SideNav />

        <section className="min-w-0 overflow-x-hidden">
          <TopBar state={state} />

          <div className="mx-auto max-w-[92rem] px-4 py-5 sm:px-6 lg:px-8">
            <ConnectionNotice state={state} />

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
              <CurrentFailure plan={currentPlan} memory={currentMemory} />
              <MemoryPanel memory={currentMemory} />
            </div>

            <MetricGrid state={state} />

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
              <PlansPanel plans={state.plans} />
              <MemoryRecordsPanel records={state.memory} />
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
              <ActivityPanel plan={currentPlan} memory={currentMemory} />
              <IntegrationsPanel state={state} />
            </div>

            <div className="mt-5">
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
          <span className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-white/10 bg-white/10 text-white">
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

      <nav className="mt-5 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap lg:flex-col">
        {navItems.map((item, index) => (
          <a
            key={item}
            href={`#${item.toLowerCase()}`}
            className={`whitespace-nowrap rounded-[8px] px-3 py-2 text-center text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)] sm:text-left ${
              index === 0
                ? "bg-white/[0.12] text-white"
                : "text-white/60 hover:bg-white/[0.08] hover:text-white"
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

function TopBar({ state }: { state: DashboardState }) {
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
          <StatusPill
            label={state.connected ? "Connected" : "Not connected"}
            tone={state.connected ? "ok" : "muted"}
          />
          <a
            href="#plans"
            className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[var(--accent)] px-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-[var(--info)]"
          >
            <IoArrowForward className="h-4 w-4" aria-hidden />
            Plans
          </a>
        </div>
      </div>
    </header>
  );
}

function ConnectionNotice({ state }: { state: DashboardState }) {
  if (state.connected && state.plans.length > 0) {
    return null;
  }

  const title = state.connected
    ? "No failed builds received"
    : "Orchestrator data is not connected";
  const body = state.connected
    ? "LoopCI is connected, but there are no repair plans yet. The console will populate after GitHub sends an accepted failed workflow event."
    : "Set LOOPCI_ORCHESTRATOR_URL or NEXT_PUBLIC_LOOPCI_ORCHESTRATOR_URL for the web app so it can read /ready, /plans, and /memory.";

  return (
    <section className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-4">
      <div className="flex gap-3">
        <IoAlertCircleOutline
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--warning)]"
          aria-hidden
        />
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
            {body}
          </p>
          {state.error ? (
            <p className="mt-2 font-mono text-xs text-[var(--danger)]">
              {state.error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CurrentFailure({
  plan,
  memory
}: {
  plan: DashboardPlan | null;
  memory: DashboardMemoryRecord | null;
}) {
  if (!plan) {
    return (
      <section className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-5">
        <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
          Current failure
        </p>
        <h2 className="mt-2 text-xl font-semibold">No active repair plan</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
          LoopCI will show the latest accepted CI failure here after the
          orchestrator creates a repair plan.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)]">
      <div className="border-b border-[var(--panel-border)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
              Current failure
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              {plan.kind} / {plan.failedStep}
            </h2>
            <div className="mt-3 flex min-w-0 flex-wrap gap-3 text-sm text-[var(--muted-foreground)]">
              <span className="inline-flex items-center gap-1.5">
                <IoGitBranchOutline className="h-4 w-4" aria-hidden />
                {plan.branch}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IoLogoGithub className="h-4 w-4" aria-hidden />
                {plan.workflow}
              </span>
              <span className="min-w-0 basis-full break-all font-mono sm:basis-auto">
                {plan.id}
              </span>
            </div>
          </div>

          {plan.risk === "low" && !plan.requiresHuman ? (
            <Link
              href={`/actions/request-fix?planId=${encodeURIComponent(
                plan.id
              )}&risk=${plan.risk}`}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[8px] bg-[var(--accent)] px-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            >
              <IoCheckmarkCircleOutline className="h-4 w-4" aria-hidden />
              Fix
            </Link>
          ) : (
            <span className="inline-flex h-10 shrink-0 items-center justify-center rounded-[8px] border border-[var(--warning)] px-3 text-sm font-semibold text-[var(--warning-strong)]">
              Review required
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-3">
        <FactBlock
          label="Seen before"
          value={memory ? `${memory.occurrenceCount} times` : "No match"}
          detail={
            memory
              ? (memory.confidenceReasoning[0] ?? "Exact fingerprint memory")
              : "No memory record linked"
          }
        />
        <FactBlock
          label="Repository"
          value={plan.repository}
          detail={plan.failedJob}
        />
        <FactBlock
          label="Next action"
          value={plan.risk === "low" ? "Draft PR" : "Manual review"}
          detail={plan.summary}
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
      <p className="mt-2 break-words text-xl font-semibold">{value}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
        {detail}
      </p>
    </div>
  );
}

function MemoryPanel({ memory }: { memory: DashboardMemoryRecord | null }) {
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
          <h2 className="mt-2 text-xl font-semibold">Recognition context</h2>
        </div>
        <IoPulseOutline
          className="h-6 w-6 text-[var(--accent-strong)]"
          aria-hidden
        />
      </div>

      {memory ? (
        <>
          <dl className="mt-5 grid grid-cols-2 gap-3">
            <MemoryDatum
              label="Confidence"
              value={formatConfidence(memory.confidence)}
            />
            <MemoryDatum
              label="Occurrences"
              value={String(memory.occurrenceCount)}
            />
            <MemoryDatum
              label="Repairs"
              value={String(memory.previousRepairCount)}
            />
            <MemoryDatum
              label="Recurring"
              value={memory.recurring ? "Yes" : "No"}
            />
          </dl>
          <div className="mt-5 border-l-2 border-[var(--accent)] pl-4">
            {memory.confidenceReasoning.length > 0 ? (
              memory.confidenceReasoning.map((reason) => (
                <p key={reason} className="text-sm leading-6">
                  {reason}
                </p>
              ))
            ) : (
              <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                Recognition has no reasoning details yet.
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="mt-5 text-sm leading-6 text-[var(--muted-foreground)]">
          No memory record is linked to the current repair plan.
        </p>
      )}
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

function MetricGrid({ state }: { state: DashboardState }) {
  return (
    <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {getDashboardMetrics(state).map((metric) => (
        <article
          key={metric.label}
          className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-4"
        >
          <p className="text-sm text-[var(--muted-foreground)]">
            {metric.label}
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold">
            {metric.value}
          </p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            {metric.detail}
          </p>
        </article>
      ))}
    </section>
  );
}

function PlansPanel({ plans }: { plans: DashboardPlan[] }) {
  return (
    <section
      id="plans"
      className="min-w-0 rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)]"
    >
      <div className="flex flex-col gap-3 border-b border-[var(--panel-border)] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
            Plans
          </p>
          <h2 className="mt-2 text-xl font-semibold">Repair plans</h2>
        </div>
        <span className="font-mono text-sm text-[var(--muted-foreground)]">
          {plans.length} total
        </span>
      </div>

      {plans.length === 0 ? (
        <EmptyPanel text="No repair plans have been created yet." />
      ) : (
        <>
          <div className="divide-y divide-[var(--panel-border)] md:hidden">
            {plans.map((plan) => (
              <article key={plan.id} className="p-4">
                <PlanHeader plan={plan} />
                <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
                  {plan.summary}
                </p>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
              <thead className="bg-[var(--panel-raised)] text-xs uppercase text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Failure</th>
                  <th className="px-4 py-3 font-semibold">Repository</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr
                    key={plan.id}
                    className="border-t border-[var(--panel-border)]"
                  >
                    <td className="px-4 py-4 align-top">
                      <p className="break-all font-mono font-semibold">
                        {plan.id}
                      </p>
                      <p className="mt-1 text-[var(--muted-foreground)]">
                        {plan.branchName}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span
                        className={`inline-flex rounded-[8px] border px-2.5 py-1 text-xs font-semibold ${riskClass[plan.risk]}`}
                      >
                        {plan.risk}
                      </span>
                      <p className="mt-2 font-semibold">{plan.kind}</p>
                      <p className="mt-1 text-[var(--muted-foreground)]">
                        {plan.failedStep}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <p className="break-words">{plan.repository}</p>
                      <p className="mt-1 text-[var(--muted-foreground)]">
                        {plan.workflow}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top">{plan.status}</td>
                    <td className="px-4 py-4 align-top">
                      <PlanAction plan={plan} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function PlanHeader({ plan }: { plan: DashboardPlan }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="break-all font-mono text-sm font-semibold">{plan.id}</p>
        <p className="mt-1 break-words text-sm text-[var(--muted-foreground)]">
          {plan.repository}
        </p>
        <p className="mt-2 font-semibold">
          {plan.kind} / {plan.failedStep}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-[8px] border px-2.5 py-1 text-xs font-semibold ${riskClass[plan.risk]}`}
      >
        {plan.risk}
      </span>
    </div>
  );
}

function PlanAction({ plan }: { plan: DashboardPlan }) {
  if (plan.risk !== "low" || plan.requiresHuman) {
    return (
      <span className="inline-flex rounded-[8px] border border-[var(--warning)] px-2.5 py-1 text-xs font-semibold text-[var(--warning-strong)]">
        Review
      </span>
    );
  }

  return (
    <Link
      href={`/actions/request-fix?planId=${encodeURIComponent(
        plan.id
      )}&risk=${plan.risk}`}
      className="inline-flex rounded-[8px] border border-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)]"
    >
      Fix
    </Link>
  );
}

function MemoryRecordsPanel({ records }: { records: DashboardMemoryRecord[] }) {
  return (
    <section className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-5">
      <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
        Memory
      </p>
      <h2 className="mt-2 text-xl font-semibold">Known failures</h2>

      {records.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-[var(--muted-foreground)]">
          No memory records exist yet.
        </p>
      ) : (
        <div className="mt-5 divide-y divide-[var(--panel-border)]">
          {records.slice(0, 5).map((record) => (
            <div key={record.id} className="py-3 first:pt-0 last:pb-0">
              <p className="font-semibold">{record.repository}</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {record.workflow}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-[8px] bg-[var(--panel-raised)] px-2 py-1 font-mono">
                  {record.occurrenceCount} occurrences
                </span>
                <span className="rounded-[8px] bg-[var(--panel-raised)] px-2 py-1 font-mono">
                  {formatConfidence(record.confidence)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ActivityPanel({
  plan,
  memory
}: {
  plan: DashboardPlan | null;
  memory: DashboardMemoryRecord | null;
}) {
  return (
    <section className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-5">
      <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
        Timeline
      </p>
      <h2 className="mt-2 text-xl font-semibold">Current case</h2>

      {!plan ? (
        <p className="mt-5 text-sm leading-6 text-[var(--muted-foreground)]">
          No case timeline is available.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          <TimelineRow
            label="plan-created"
            time={plan.createdAt}
            detail={plan.summary}
          />
          {memory ? (
            <TimelineRow
              label="memory-linked"
              time={memory.lastObservedAt}
              detail={`${memory.occurrenceCount} observed occurrence${
                memory.occurrenceCount === 1 ? "" : "s"
              }`}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}

function IntegrationsPanel({ state }: { state: DashboardState }) {
  const integrations = state.integrations;

  return (
    <section
      id="integrations"
      className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-5"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--muted-foreground)]">
            Integrations
          </p>
          <h2 className="mt-2 text-xl font-semibold">Outbound routes</h2>
        </div>
        <StatusPill
          label={
            integrations?.notificationsEnabled
              ? "Notifications on"
              : "Notifications off"
          }
          tone={integrations?.notificationsEnabled ? "ok" : "muted"}
        />
      </div>

      {!integrations ? (
        <p className="mt-5 text-sm leading-6 text-[var(--muted-foreground)]">
          Integration status is unavailable from the orchestrator.
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {integrations.channels.map((channel) => (
              <IntegrationItem key={channel.name} channel={channel} />
            ))}
          </div>

          <div className="mt-5 border-t border-[var(--panel-border)] pt-4 text-sm leading-6 text-[var(--muted-foreground)]">
            <p>
              Routing uses the GitHub triggering actor first, then the actor,
              then commit author email only when email fallback is enabled.
            </p>
            <p className="mt-2">
              {integrations.usersConfigured} actor route
              {integrations.usersConfigured === 1 ? "" : "s"} configured.
              {integrations.routingConfigPathConfigured
                ? integrations.routingConfigLoaded
                  ? " Routing file loaded."
                  : " Routing file failed to load."
                : " No routing file path set."}
            </p>
            {integrations.routingConfigError ? (
              <p className="mt-2 font-mono text-xs text-[var(--danger)]">
                {integrations.routingConfigError}
              </p>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

function IntegrationItem({
  channel
}: {
  channel: DashboardIntegrationChannel;
}) {
  const configured = channel.state === "configured";
  const disabled = channel.state === "disabled";

  return (
    <article className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel-raised)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{channel.name}</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {channel.source}
          </p>
        </div>
        {configured ? (
          <IoCheckmarkCircleOutline
            className="h-5 w-5 shrink-0 text-[var(--accent-strong)]"
            aria-hidden
          />
        ) : (
          <IoRadioButtonOffOutline
            className={`h-5 w-5 shrink-0 ${
              disabled
                ? "text-[var(--muted-foreground)]"
                : "text-[var(--warning)]"
            }`}
            aria-hidden
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span
          className={`rounded-[8px] border px-2.5 py-1 text-xs font-semibold ${
            configured
              ? "border-[var(--accent)] text-[var(--accent-strong)]"
              : "border-[var(--panel-border)] text-[var(--muted-foreground)]"
          }`}
        >
          {configured
            ? "Ready"
            : disabled
              ? "Disabled"
              : "Not configured"}
        </span>
        <span className="rounded-[8px] bg-[var(--panel)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
          {channel.detail}
        </span>
      </div>
    </article>
  );
}

function TimelineRow({
  label,
  time,
  detail
}: {
  label: string;
  time: string;
  detail: string;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3">
      <span className="font-mono text-xs text-[var(--muted-foreground)]">
        {formatDate(time)}
      </span>
      <div className="border-l border-[var(--panel-border)] pl-4">
        <p className="font-mono text-sm font-semibold">{label}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
          {detail}
        </p>
      </div>
    </div>
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
          Enforced by orchestrator
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <PolicyItem
          title="No auto-merge"
          body="LoopCI prepares repair work only."
        />
        <PolicyItem
          title="Low risk only"
          body="Fix requests require policy-approved low risk."
        />
        <PolicyItem
          title="Secrets denied"
          body="Production secret writes are outside repair scope."
        />
        <PolicyItem
          title="Human authority"
          body="Reviewers decide merge and deployment."
        />
      </div>
    </section>
  );
}

function PolicyItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel-raised)] p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
        {body}
      </p>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="p-5 text-sm leading-6 text-[var(--muted-foreground)]">
      {text}
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "ok" | "muted" }) {
  return (
    <span
      className={`inline-flex h-10 items-center rounded-[8px] border px-3 text-sm font-semibold ${
        tone === "ok"
          ? "border-[var(--accent)] text-[var(--accent-strong)]"
          : "border-[var(--panel-border)] text-[var(--muted-foreground)]"
      }`}
    >
      {label}
    </span>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "2-digit"
  }).format(date);
}
