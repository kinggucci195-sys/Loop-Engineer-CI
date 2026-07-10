import type { LoopCiEnv } from "@loopci/config";

export function createOutboundAbortSignal(env: LoopCiEnv): AbortSignal {
  return AbortSignal.timeout(env.LOOPCI_OUTBOUND_TIMEOUT_MS);
}

export function getOutboundTimeoutMs(env: LoopCiEnv): number {
  return env.LOOPCI_OUTBOUND_TIMEOUT_MS;
}
