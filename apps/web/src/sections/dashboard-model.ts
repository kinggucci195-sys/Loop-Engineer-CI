export type RiskLevel = "low" | "medium" | "high";
export type PlanState = "ready" | "review" | "queued";

export interface ActiveIncident {
  repository: string;
  branch: string;
  workflow: string;
  failedStep: string;
  failureKind: string;
  status: string;
  seenCount: number;
  lastFixedBy: string;
  averageResolution: string;
  lastSuccessfulRepair: string;
  repairSuccessRate: string;
  likelyOwner: string;
  recognitionConfidence: string;
  nextAction: string;
}

export interface RepairPlanRow {
  id: string;
  repository: string;
  branch: string;
  failure: string;
  owner: string;
  risk: RiskLevel;
  state: PlanState;
  memory: string;
  nextAction: string;
  route: string;
}

export interface ProductMetric {
  label: string;
  value: string;
  detail: string;
  trend: string;
}

export interface RouteStatus {
  channel: string;
  destination: string;
  status: "ready" | "fallback";
}

export const activeIncident: ActiveIncident = {
  repository: "kinggucci195-sys/loopci",
  branch: "main",
  workflow: "CI / Validate",
  failedStep: "npm test",
  failureKind: "unit-test",
  status: "recognized",
  seenCount: 6,
  lastFixedBy: "Justin",
  averageResolution: "11m",
  lastSuccessfulRepair: "Regenerate generated types, then rerun typecheck.",
  repairSuccessRate: "5 / 6",
  likelyOwner: "Platform",
  recognitionConfidence: "91%",
  nextAction: "Request a draft repair PR after policy review."
};

export const productMetrics: ProductMetric[] = [
  {
    label: "Failures recognized",
    value: "42%",
    detail: "Matched to prior memory",
    trend: "+8% this week"
  },
  {
    label: "Known working fixes",
    value: "18",
    detail: "Have verified outcomes",
    trend: "7 repeated"
  },
  {
    label: "Median owner route",
    value: "4m",
    detail: "Failure to assignee",
    trend: "-31%"
  },
  {
    label: "Repeat failures",
    value: "12",
    detail: "Open recurring signatures",
    trend: "-3"
  }
];

export const repairQueue: RepairPlanRow[] = [
  {
    id: "plan-5006",
    repository: "kinggucci195-sys/loopci",
    branch: "main",
    failure: "unit-test",
    owner: "Platform",
    risk: "low",
    state: "ready",
    memory: "Seen 6x; fix worked 5 / 6",
    nextAction: "Draft repair PR",
    route: "Slack + Teams"
  },
  {
    id: "plan-4421",
    repository: "web-dashboard",
    branch: "release/2026-07",
    failure: "typecheck",
    owner: "Frontend",
    risk: "low",
    state: "queued",
    memory: "Seen 2x; last fixed by Maya",
    nextAction: "Regenerate contract types",
    route: "Teams"
  },
  {
    id: "plan-2002",
    repository: "billing-api",
    branch: "feature/invoices",
    failure: "workflow-config",
    owner: "DevOps",
    risk: "high",
    state: "review",
    memory: "First time in this workflow",
    nextAction: "Manual review",
    route: "Email fallback"
  }
];

export const routeStatuses: RouteStatus[] = [
  {
    channel: "Slack",
    destination: "#platform-ci",
    status: "ready"
  },
  {
    channel: "Teams",
    destination: "Build response",
    status: "ready"
  },
  {
    channel: "Email",
    destination: "Commit author fallback",
    status: "fallback"
  }
];

export const policyRows = [
  ["Auto merge", "Off", "Human-owned"],
  ["Low-risk fixes", "Draft PR", "Allowed after confirmation"],
  ["Medium/high risk", "Blocked", "Review required"],
  ["Secrets", "Never patched", "Denied by policy"]
] as const;

export const caseTimeline = [
  ["14:40", "failure-observed", "CI run failed at npm test"],
  ["14:40", "recognized", "Exact fingerprint matched 6 events"],
  ["14:41", "owner-routed", "Platform channel selected"],
  ["14:42", "repair-requested", "Draft PR request waiting on gate"]
] as const;

export function getActionablePlanCount(plans = repairQueue): number {
  return plans.filter((plan) => plan.risk === "low" && plan.state !== "review")
    .length;
}

export function getDashboardTextCorpus(): string {
  return [
    activeIncident.repository,
    activeIncident.workflow,
    activeIncident.failureKind,
    activeIncident.lastSuccessfulRepair,
    activeIncident.nextAction,
    ...productMetrics.flatMap((metric) => [
      metric.label,
      metric.value,
      metric.detail,
      metric.trend
    ]),
    ...repairQueue.flatMap((plan) => [
      plan.repository,
      plan.failure,
      plan.memory,
      plan.nextAction
    ])
  ].join(" ");
}
