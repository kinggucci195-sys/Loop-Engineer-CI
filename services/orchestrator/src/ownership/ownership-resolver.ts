import type { CiFailureEvent, FailureClassification } from "@loopci/contracts";

export type OwnershipSource =
  "triggering-actor" | "actor" | "commit-author-email" | "unknown";

export interface OwnershipResolution {
  owner?: string;
  source: OwnershipSource;
}

export interface OwnershipResolver {
  resolve(
    event: CiFailureEvent,
    classification: FailureClassification
  ): Promise<OwnershipResolution>;
}

export function createFallbackOwnershipResolver(): OwnershipResolver {
  return {
    resolve: async (event) => {
      if (event.triggeringActor) {
        return {
          owner: event.triggeringActor,
          source: "triggering-actor"
        };
      }

      if (event.actor) {
        return {
          owner: event.actor,
          source: "actor"
        };
      }

      if (event.commitAuthorEmail) {
        return {
          owner: event.commitAuthorEmail,
          source: "commit-author-email"
        };
      }

      return {
        source: "unknown"
      };
    }
  };
}
