import {
  GuardrailList,
  LoopStageList,
  MetricGrid,
  PipelinePanel
} from "../sections/dashboard";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="border-b border-[var(--panel-border)] bg-[var(--panel)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--accent-strong)]">
                AI CI/CD control plane
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal md:text-5xl">
                LoopCI
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--muted-foreground)]">
                Diagnose failed pipelines, prepare low-risk repair plans, and
                keep merge and deploy authority behind deterministic checks.
              </p>
            </div>
            <div className="rounded-[8px] border border-[var(--panel-border)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                Autonomy level
              </p>
              <p className="mt-1 text-lg font-semibold">PR-only repair</p>
            </div>
          </div>
          <MetricGrid />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1.35fr_0.65fr] lg:px-8">
        <PipelinePanel />
        <GuardrailList />
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-10 lg:px-8">
        <LoopStageList />
      </section>
    </main>
  );
}
