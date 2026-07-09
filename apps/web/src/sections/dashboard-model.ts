type RiskLevel = "low" | "medium" | "high";

export interface DashboardPlan {
  id: string;
  repository: string;
  workflow: string;
  runUrl: string;
  branch: string;
  failedJob: string;
  failedStep: string;
  createdAt: string;
  status: string;
  branchName: string;
  goal: string;
  risk: RiskLevel;
  kind: string;
  summary: string;
  requiresHuman: boolean;
  memoryRecordId?: string;
}

export interface DashboardMemoryRecord {
  id: string;
  repository: string;
  workflow: string;
  owner?: string;
  occurrenceCount: number;
  previousRepairCount: number;
  lastSuccessfulRepairPlanId?: string;
  lastObservedAt: string;
  confidence: number;
  confidenceReasoning: string[];
  seenBefore: boolean;
  recurring: boolean;
}

type IntegrationState = "disabled" | "configured" | "not-configured";

export interface DashboardIntegrationChannel {
  name: string;
  state: IntegrationState;
  source: string;
  detail: string;
}

export interface DashboardIntegrations {
  notificationsEnabled: boolean;
  routingConfigLoaded: boolean;
  routingConfigPathConfigured: boolean;
  routingConfigError?: string;
  usersConfigured: number;
  channels: DashboardIntegrationChannel[];
}

export interface DashboardState {
  connected: boolean;
  orchestratorUrl?: string;
  ready?: {
    ok: boolean;
    planCount: number;
  };
  plans: DashboardPlan[];
  memory: DashboardMemoryRecord[];
  integrations?: DashboardIntegrations;
  error?: string;
}

interface RawPlanResponse {
  plans?: unknown[];
}

interface RawMemoryResponse {
  records?: unknown[];
}

interface RawReadyResponse {
  ok?: unknown;
  planCount?: unknown;
}

interface RawIntegrationStatusResponse {
  notificationsEnabled?: unknown;
  routingConfigPathConfigured?: unknown;
  routingConfigLoaded?: unknown;
  routingConfigError?: unknown;
  usersConfigured?: unknown;
  commitAuthorEmailFallback?: unknown;
  channels?: unknown;
}

export function resolveOrchestratorUrl(): string | undefined {
  const value =
    process.env.LOOPCI_ORCHESTRATOR_URL ??
    process.env.NEXT_PUBLIC_LOOPCI_ORCHESTRATOR_URL;

  if (value) {
    return value.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:4000";
  }

  return undefined;
}

export async function loadDashboardState(): Promise<DashboardState> {
  const orchestratorUrl = resolveOrchestratorUrl();

  if (!orchestratorUrl) {
    return {
      connected: false,
      plans: [],
      memory: []
    };
  }

  try {
    const [ready, plans, memory, integrations] = await Promise.all([
      fetchJson<RawReadyResponse>(`${orchestratorUrl}/ready`),
      fetchJson<RawPlanResponse>(`${orchestratorUrl}/plans`),
      fetchJson<RawMemoryResponse>(`${orchestratorUrl}/memory`),
      fetchJson<RawIntegrationStatusResponse>(
        `${orchestratorUrl}/integrations/status`
      )
    ]);

    return {
      connected: true,
      orchestratorUrl,
      ready: {
        ok: ready.ok === true,
        planCount: typeof ready.planCount === "number" ? ready.planCount : 0
      },
      plans: Array.isArray(plans.plans)
        ? plans.plans.map(toDashboardPlan).filter(isDefined)
        : [],
      memory: Array.isArray(memory.records)
        ? memory.records.map(toDashboardMemoryRecord).filter(isDefined)
        : [],
      integrations: toDashboardIntegrations(integrations)
    };
  } catch (error) {
    return {
      connected: false,
      orchestratorUrl,
      plans: [],
      memory: [],
      error: error instanceof Error ? error.message : "Unknown fetch error"
    };
  }
}

export function getDashboardMetrics(state: DashboardState) {
  const activePlans = state.plans.filter((plan) => plan.status !== "closed");
  const blockedPlans = state.plans.filter(
    (plan) => plan.risk !== "low" || plan.requiresHuman
  );
  const readyForFix = state.plans.filter(
    (plan) => plan.risk === "low" && !plan.requiresHuman
  );
  const recognizedFailures = state.memory.filter((record) => record.seenBefore);

  return [
    {
      label: "Active plans",
      value: String(activePlans.length),
      detail: "Open repair plans"
    },
    {
      label: "Recognized failures",
      value: String(recognizedFailures.length),
      detail: "Matched to memory"
    },
    {
      label: "Ready for fix",
      value: String(readyForFix.length),
      detail: "Low-risk plans"
    },
    {
      label: "Review gates",
      value: String(blockedPlans.length),
      detail: "Human approval required"
    }
  ];
}

export function getCurrentPlan(plans: DashboardPlan[]): DashboardPlan | null {
  return (
    [...plans].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    )[0] ?? null
  );
}

export function findMemoryForPlan(
  plan: DashboardPlan | null,
  memory: DashboardMemoryRecord[]
): DashboardMemoryRecord | null {
  if (!plan?.memoryRecordId) {
    return null;
  }

  return memory.find((record) => record.id === plan.memoryRecordId) ?? null;
}

export function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function getDashboardTextCorpus(state: DashboardState): string {
  return [
    ...state.plans.flatMap((plan) => [
      plan.repository,
      plan.workflow,
      plan.failedJob,
      plan.failedStep,
      plan.summary,
      plan.goal
    ]),
    ...state.memory.flatMap((record) => [
      record.repository,
      record.workflow,
      record.owner ?? "",
      ...record.confidenceReasoning
    ]),
    ...(state.integrations?.channels.flatMap((channel) => [
      channel.name,
      channel.source,
      channel.detail
    ]) ?? [])
  ].join(" ");
}

async function fetchJson<T>(url: string): Promise<T> {
  const headers =
    process.env.LOOPCI_API_TOKEN &&
    process.env.LOOPCI_API_TOKEN.trim().length > 0
      ? { authorization: `Bearer ${process.env.LOOPCI_API_TOKEN}` }
      : undefined;
  const response = await fetch(url, {
    cache: "no-store",
    ...(headers ? { headers } : {})
  });

  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${url}`);
  }

  return (await response.json()) as T;
}

function toDashboardPlan(value: unknown): DashboardPlan | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const classification = isRecord(value.classification)
    ? value.classification
    : {};
  const event = isRecord(value.event) ? value.event : {};
  const risk = toRiskLevel(classification.risk);

  if (
    !risk ||
    typeof value.id !== "string" ||
    typeof value.status !== "string" ||
    typeof value.branchName !== "string" ||
    typeof value.goal !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof event.repository !== "string" ||
    typeof event.workflow !== "string" ||
    typeof event.runUrl !== "string" ||
    typeof event.branch !== "string" ||
    typeof event.failedJob !== "string" ||
    typeof event.failedStep !== "string" ||
    typeof classification.kind !== "string" ||
    typeof classification.summary !== "string" ||
    typeof classification.requiresHuman !== "boolean"
  ) {
    return undefined;
  }

  return {
    id: value.id,
    repository: event.repository,
    workflow: event.workflow,
    runUrl: event.runUrl,
    branch: event.branch,
    failedJob: event.failedJob,
    failedStep: event.failedStep,
    createdAt: value.createdAt,
    status: value.status,
    branchName: value.branchName,
    goal: value.goal,
    risk,
    kind: classification.kind,
    summary: classification.summary,
    requiresHuman: classification.requiresHuman,
    ...(typeof value.memoryRecordId === "string"
      ? { memoryRecordId: value.memoryRecordId }
      : {})
  };
}

function toDashboardMemoryRecord(
  value: unknown
): DashboardMemoryRecord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const record = isRecord(value.record) ? value.record : {};
  const recognition = isRecord(value.recognition) ? value.recognition : {};
  const relationships = isRecord(record.relationships)
    ? record.relationships
    : {};

  if (
    typeof record.id !== "string" ||
    typeof record.occurrenceCount !== "number" ||
    typeof record.previousRepairCount !== "number" ||
    typeof record.lastObservedAt !== "string" ||
    typeof recognition.confidence !== "number" ||
    typeof recognition.seenBefore !== "boolean" ||
    typeof recognition.recurring !== "boolean"
  ) {
    return undefined;
  }

  return {
    id: record.id,
    repository:
      typeof relationships.repository === "string"
        ? relationships.repository
        : "Unknown repository",
    workflow:
      typeof relationships.workflow === "string"
        ? relationships.workflow
        : "Unknown workflow",
    occurrenceCount: record.occurrenceCount,
    previousRepairCount: record.previousRepairCount,
    lastObservedAt: record.lastObservedAt,
    confidence: recognition.confidence,
    confidenceReasoning: Array.isArray(recognition.confidenceReasoning)
      ? recognition.confidenceReasoning.filter(
          (reason): reason is string => typeof reason === "string"
        )
      : [],
    seenBefore: recognition.seenBefore,
    recurring: recognition.recurring,
    ...(typeof relationships.owner === "string"
      ? { owner: relationships.owner }
      : {}),
    ...(typeof record.lastSuccessfulRepairPlanId === "string"
      ? { lastSuccessfulRepairPlanId: record.lastSuccessfulRepairPlanId }
      : {})
  };
}

function toDashboardIntegrations(
  value: RawIntegrationStatusResponse
): DashboardIntegrations {
  const channels = isRecord(value.channels) ? value.channels : {};
  const notificationsEnabled = value.notificationsEnabled === true;

  return {
    notificationsEnabled,
    routingConfigLoaded: value.routingConfigLoaded === true,
    routingConfigPathConfigured: value.routingConfigPathConfigured === true,
    ...(typeof value.routingConfigError === "string"
      ? { routingConfigError: value.routingConfigError }
      : {}),
    usersConfigured:
      typeof value.usersConfigured === "number" ? value.usersConfigured : 0,
    channels: [
      toChatChannel(
        "Teams",
        isRecord(channels.teams) ? channels.teams : {},
        notificationsEnabled
      ),
      toChatChannel(
        "Slack",
        isRecord(channels.slack) ? channels.slack : {},
        notificationsEnabled
      ),
      toEmailChannel(
        isRecord(channels.email) ? channels.email : {},
        notificationsEnabled,
        value.commitAuthorEmailFallback === true
      ),
      toJiraChannel(
        isRecord(channels.jira) ? channels.jira : {},
        notificationsEnabled
      )
    ]
  };
}

function toChatChannel(
  name: string,
  value: Record<string, unknown>,
  notificationsEnabled: boolean
): DashboardIntegrationChannel {
  const userRoutes =
    typeof value.userRoutes === "number" ? value.userRoutes : 0;
  const source = toSource(value.source);
  const configured = value.configured === true;

  return {
    name,
    state: toIntegrationState(configured, notificationsEnabled),
    source: sourceLabel(source),
    detail:
      userRoutes > 0
        ? `${userRoutes} actor route${userRoutes === 1 ? "" : "s"}`
        : source === "none"
          ? "No webhook route"
          : "Default route"
  };
}

function toEmailChannel(
  value: Record<string, unknown>,
  notificationsEnabled: boolean,
  commitAuthorEmailFallback: boolean
): DashboardIntegrationChannel {
  const defaultRecipients =
    typeof value.defaultRecipients === "number" ? value.defaultRecipients : 0;
  const userRoutes =
    typeof value.userRoutes === "number" ? value.userRoutes : 0;
  const smtpConfigured = value.smtpConfigured === true;
  const source = toSource(value.source);
  const configured = value.configured === true;
  const recipientCount = defaultRecipients + userRoutes;

  return {
    name: "Email",
    state: toIntegrationState(configured, notificationsEnabled),
    source: smtpConfigured ? sourceLabel(source) : "SMTP missing",
    detail:
      recipientCount > 0
        ? `${recipientCount} recipient route${recipientCount === 1 ? "" : "s"}`
        : commitAuthorEmailFallback
          ? "Commit author fallback"
          : "No recipients"
  };
}

function toJiraChannel(
  value: Record<string, unknown>,
  notificationsEnabled: boolean
): DashboardIntegrationChannel {
  const configured = value.configured === true;
  const createIssues = value.createIssues === true;
  const projectKeyConfigured = value.projectKeyConfigured === true;

  return {
    name: "Jira",
    state: toIntegrationState(configured, notificationsEnabled),
    source: createIssues ? "Issue creation" : "Disabled",
    detail: projectKeyConfigured ? "Project key set" : "No project key"
  };
}

function toIntegrationState(
  configured: boolean,
  notificationsEnabled: boolean
): IntegrationState {
  if (!notificationsEnabled) {
    return "disabled";
  }

  return configured ? "configured" : "not-configured";
}

function toSource(value: unknown): string {
  return typeof value === "string" ? value : "none";
}

function sourceLabel(value: string): string {
  switch (value) {
    case "env":
      return "Environment";
    case "routing-file":
      return "Routing file";
    case "per-user":
      return "Actor route";
    case "commit-author-fallback":
      return "Commit author";
    case "smtp":
      return "SMTP";
    default:
      return "Not configured";
  }
}

function toRiskLevel(value: unknown): RiskLevel | undefined {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
