const METRICS = [
  { id: "mttr", label: "Mean repair time", value: "pending", tone: "info" },
  { id: "queued", label: "Queued plans", value: "0", tone: "accent" },
  { id: "blocked", label: "Human gates", value: "required", tone: "warning" },
  { id: "risk", label: "Production authority", value: "off", tone: "danger" }
] as const;

const STAGES = [
  {
    id: "discover",
    title: "Discover",
    description: "Webhook and scheduled events capture failed CI signals."
  },
  {
    id: "classify",
    title: "Classify",
    description: "The triage agent separates lint, type, test, dependency, flaky, and workflow failures."
  },
  {
    id: "plan",
    title: "Plan",
    description: "Low-risk failures become isolated repair plans with explicit stop conditions."
  },
  {
    id: "evaluate",
    title: "Evaluate",
    description: "Deterministic checks and a separate evaluator decide whether evidence is strong enough."
  },
  {
    id: "review",
    title: "Review",
    description: "Humans keep merge and deploy authority until the loop earns more trust."
  }
] as const;

const GUARDRAILS = [
  "No auto-merge in the MVP",
  "No production secrets in patch sandboxes",
  "CI workflow edits require human review",
  "Retry, token, and wall-clock budgets are mandatory",
  "Every plan needs an evidence bundle"
] as const;

function toneClass(tone: (typeof METRICS)[number]["tone"]) {
  const classes = {
    accent: "text-[var(--accent-strong)]",
    warning: "text-[var(--warning)]",
    danger: "text-[var(--danger)]",
    info: "text-[var(--info)]"
  };

  return classes[tone];
}

/**
 * MetricGrid - Shows the operating posture of the LoopCI control plane.
 *
 * @description
 * Presents compact status metrics that make autonomy, risk, and queue state easy
 * to scan before inspecting individual repair plans.
 *
 * @returns {JSX.Element} Dashboard metric grid
 */
export function MetricGrid() {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {METRICS.map((metric) => (
        <div
          key={metric.id}
          className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--background)] p-4"
        >
          <dt className="text-sm text-[var(--muted-foreground)]">{metric.label}</dt>
          <dd className={`mt-2 text-2xl font-semibold ${toneClass(metric.tone)}`}>
            {metric.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * PipelinePanel - Summarizes how failed CI events move through LoopCI.
 *
 * @description
 * Keeps the primary workflow visible as a control-plane panel rather than a
 * marketing explainer.
 *
 * @returns {JSX.Element} Pipeline overview panel
 */
export function PipelinePanel() {
  return (
    <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Pipeline repair loop</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Current mode: observe and prepare PR-only repair plans.
          </p>
        </div>
        <span className="rounded-[8px] bg-[var(--muted)] px-3 py-2 text-sm font-medium">
          Safe mode
        </span>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {["Webhook", "Triage agent", "Evidence bundle"].map((item) => (
          <div
            key={item}
            className="min-h-28 rounded-[8px] border border-[var(--panel-border)] p-4"
          >
            <p className="text-sm font-semibold">{item}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              {item === "Webhook"
                ? "Receives failed workflow events and normalizes the payload."
                : item === "Triage agent"
                  ? "Classifies failure type, confidence, risk, and required checks."
                  : "Packages commands, residual risk, and human review notes."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * GuardrailList - Displays the non-negotiable safety boundaries.
 *
 * @description
 * Highlights the controls that keep AI assistance inside CI/CD authority
 * boundaries until the loop has proven reliability.
 *
 * @returns {JSX.Element} Guardrail checklist panel
 */
export function GuardrailList() {
  return (
    <aside className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-5">
      <h2 className="text-xl font-semibold">Guardrails</h2>
      <ul className="mt-5 space-y-3">
        {GUARDRAILS.map((guardrail) => (
          <li key={guardrail} className="flex gap-3 text-sm leading-6">
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
            <span>{guardrail}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/**
 * LoopStageList - Lists each stage in the AI CI/CD loop.
 *
 * @description
 * Uses stable identifiers and concise stage descriptions so operators can scan
 * the loop without reading long-form documentation.
 *
 * @returns {JSX.Element} Ordered loop stage list
 */
export function LoopStageList() {
  return (
    <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-5">
      <h2 className="text-xl font-semibold">Loop stages</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-5">
        {STAGES.map((stage) => (
          <article
            key={stage.id}
            className="rounded-[8px] border border-[var(--panel-border)] p-4"
          >
            <h3 className="font-semibold">{stage.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              {stage.description}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
