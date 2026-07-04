import Link from "next/link";
import {
  IoArrowBack,
  IoCheckmarkCircleOutline,
  IoGitPullRequestOutline,
  IoShieldCheckmarkOutline
} from "react-icons/io5";

interface RequestFixPageProps {
  searchParams: Promise<{
    planId?: string;
    risk?: string;
  }>;
}

export default async function RequestFixPage({
  searchParams
}: RequestFixPageProps) {
  const { planId = "selected-plan", risk = "low" } = await searchParams;
  const orchestratorUrl = process.env.NEXT_PUBLIC_LOOPCI_ORCHESTRATOR_URL;
  const actionUrl = orchestratorUrl
    ? `${orchestratorUrl.replace(
        /\/$/,
        ""
      )}/actions/plans/${encodeURIComponent(planId)}/request-fix`
    : undefined;
  const canRequest = risk === "low" && Boolean(actionUrl);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5 py-10 text-[var(--foreground)]">
      <section className="w-full max-w-[42rem] rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel)] p-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-[8px] text-sm font-semibold text-[var(--muted-foreground)] transition-colors duration-200 hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        >
          <IoArrowBack className="h-4 w-4" aria-hidden />
          Back to dashboard
        </Link>

        <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-[8px] border border-[var(--accent)] bg-[oklch(0.23_0.05_151)] text-[var(--accent-strong)]">
          <IoGitPullRequestOutline className="h-6 w-6" aria-hidden />
        </div>

        <h1 className="mt-5 text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.05]">
          Fix request checkpoint
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--muted-foreground)]">
          Plan{" "}
          <span className="font-semibold text-[var(--foreground)]">
            {planId}
          </span>{" "}
          can only request a draft repair PR after policy and orchestrator
          checks pass.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel-raised)] p-4">
            <IoShieldCheckmarkOutline
              className="h-5 w-5 text-[var(--warning)]"
              aria-hidden
            />
            <p className="mt-3 text-sm font-semibold">Policy gate</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              Medium and high-risk plans stay blocked for review.
            </p>
          </div>
          <div className="rounded-[8px] border border-[var(--panel-border)] bg-[var(--panel-raised)] p-4">
            <IoCheckmarkCircleOutline
              className="h-5 w-5 text-[var(--accent-strong)]"
              aria-hidden
            />
            <p className="mt-3 text-sm font-semibold">Worker queue</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              Low-risk requests move into evidence collection.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {canRequest && actionUrl ? (
            <a
              href={actionUrl}
              className="inline-flex h-11 items-center justify-center rounded-[8px] bg-[var(--accent)] px-4 text-sm font-semibold text-[oklch(0.12_0.01_105)] transition-colors duration-200 hover:bg-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-[var(--accent-strong)]"
            >
              Request draft repair PR
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex h-11 cursor-not-allowed items-center justify-center rounded-[8px] border border-[var(--panel-border)] px-4 text-sm font-semibold text-[var(--muted-foreground)]"
            >
              Connect orchestrator URL
            </button>
          )}
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[var(--panel-border)] px-4 text-sm font-semibold transition-colors duration-200 hover:bg-[var(--panel-raised)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          >
            Cancel
          </Link>
        </div>
      </section>
    </main>
  );
}
