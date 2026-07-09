import OpenAI from "openai";
import type {
  CiFailureEvent,
  FailureClassification,
  FailureKind
} from "@loopci/contracts";
import { classificationSchema } from "@loopci/contracts";
import type { LoopCiEnv } from "@loopci/config";

export interface FailureClassifier {
  classify(event: CiFailureEvent): Promise<FailureClassification>;
}

const FAILURE_PATTERNS: Array<{
  kind: FailureKind;
  pattern: RegExp;
  checks: string[];
}> = [
  {
    kind: "flaky-or-noisy",
    pattern:
      /flaky|intermittent|random|timeout|timed out|connection reset|econnreset|socket hang up|rate limit|temporarily unavailable/i,
    checks: [
      "rerun failed job once",
      "rerun the failed test in isolation",
      "check flaky-test history before changing product code"
    ]
  },
  {
    kind: "format",
    pattern: /prettier|format|formatted|formatting/i,
    checks: ["npm run format:check"]
  },
  {
    kind: "lint",
    pattern: /eslint|lint|no-console|no-explicit-any/i,
    checks: ["npm run lint"]
  },
  {
    kind: "typecheck",
    pattern:
      /typescript|tsc|type error|is not assignable|cannot find name|compilation failed|compile error/i,
    checks: ["npm run typecheck"]
  },
  {
    kind: "e2e-test",
    pattern: /playwright|cypress|selenium|browser test|end-to-end|e2e/i,
    checks: [
      "rerun the failed e2e spec",
      "capture browser trace or screenshot evidence"
    ]
  },
  {
    kind: "integration-test",
    pattern:
      /integration test|testcontainers|docker compose|service unavailable|econnrefused|database connection|redis|postgres/i,
    checks: [
      "rerun the integration test target",
      "verify dependent services are healthy"
    ]
  },
  {
    kind: "unit-test",
    pattern: /jest|expect\(|toBe|toEqual|test failed|assertion/i,
    checks: ["npm test", "rerun the failed test in isolation"]
  },
  {
    kind: "dependency",
    pattern:
      /npm ci|npm install|yarn install|pnpm install|eresolve|package-lock|lockfile|dependency|peer dep|cannot find module|module not found/i,
    checks: ["npm ci", "npm audit --audit-level=high"]
  },
  {
    kind: "environment",
    pattern:
      /missing env|environment variable|node version|setup-node|command not found|not recognized as|enoent|path not found|port already in use/i,
    checks: [
      "verify CI environment variables",
      "verify runner setup and tool versions"
    ]
  },
  {
    kind: "workflow-config",
    pattern: /workflow|yaml|actions\/checkout|uses:|github actions/i,
    checks: ["npm run typecheck", "npm run lint"]
  },
  {
    kind: "secret-or-permission",
    pattern: /permission|forbidden|unauthorized|secret|token|access denied/i,
    checks: ["review workflow permissions and secret scopes"]
  }
];

function extractLikelyFiles(logExcerpt: string): string[] {
  const matches = logExcerpt.match(
    /[A-Za-z0-9_./-]+\.(ts|tsx|js|jsx|json|ya?ml)/g
  );
  return Array.from(new Set(matches ?? [])).slice(0, 8);
}

function classifyByHeuristic(event: CiFailureEvent): FailureClassification {
  const pattern = FAILURE_PATTERNS.find((candidate) =>
    candidate.pattern.test(`${event.failedStep}\n${event.logExcerpt}`)
  );
  const kind = pattern?.kind ?? "unknown";
  const isHighRisk =
    kind === "secret-or-permission" || kind === "workflow-config";
  const isLowRisk = kind === "format" || kind === "lint";

  return {
    kind,
    risk: isHighRisk ? "high" : isLowRisk ? "low" : "medium",
    confidence: pattern ? 0.72 : 0.35,
    summary: `LoopCI classified ${event.failedJob}/${event.failedStep} as ${kind}.`,
    likelyFiles: extractLikelyFiles(event.logExcerpt),
    recommendedChecks: pattern?.checks ?? [
      "rerun failed command",
      "inspect CI logs"
    ],
    requiresHuman: !isLowRisk,
    rationale:
      "Heuristic classification is based on failed step names, log signatures, and known CI failure categories."
  };
}

export function createHeuristicClassifier(): FailureClassifier {
  return {
    classify: async (event) => classifyByHeuristic(event)
  };
}

export function createOpenAiClassifier(env: LoopCiEnv): FailureClassifier {
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  return {
    classify: async (event) => {
      const response = await client.responses.create({
        model: env.OPENAI_MODEL,
        input: [
          {
            role: "system",
            content:
              "Classify CI failures for a safe AI CI/CD repair loop. Return compact JSON only."
          },
          {
            role: "user",
            content: JSON.stringify({
              event,
              allowedKinds: FAILURE_PATTERNS.map((item) => item.kind)
            })
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "failure_classification",
            schema: {
              type: "object",
              additionalProperties: false,
              required: [
                "kind",
                "risk",
                "confidence",
                "summary",
                "likelyFiles",
                "recommendedChecks",
                "requiresHuman",
                "rationale"
              ],
              properties: {
                kind: { type: "string" },
                risk: { type: "string", enum: ["low", "medium", "high"] },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                summary: { type: "string" },
                likelyFiles: { type: "array", items: { type: "string" } },
                recommendedChecks: { type: "array", items: { type: "string" } },
                requiresHuman: { type: "boolean" },
                rationale: { type: "string" }
              }
            },
            strict: true
          }
        }
      });

      const outputText = response.output_text;
      return classificationSchema.parse(JSON.parse(outputText));
    }
  };
}

export function createFailureClassifier(env: LoopCiEnv): FailureClassifier {
  if (env.LOOPCI_AI_PROVIDER === "openai") {
    return createOpenAiClassifier(env);
  }

  return createHeuristicClassifier();
}
