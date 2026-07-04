import {
  createEmptyNotificationConfig,
  type NotificationConfig
} from "../notification-config";
import { resolveNotificationTarget } from "../dispatcher";
import { createNotificationTestPlan } from "./notification-test-fixture";

describe("notification routing", () => {
  it("routes to the configured GitHub actor email", () => {
    const config: NotificationConfig = {
      ...createEmptyNotificationConfig(),
      users: {
        "kinggucci195-sys": {
          email: "dev@example.com"
        }
      }
    };

    const target = resolveNotificationTarget(
      createNotificationTestPlan({ actor: "kinggucci195-sys" }),
      config
    );

    expect(target.emails).toEqual(["dev@example.com"]);
  });

  it("falls back to commit author email when no actor mapping exists", () => {
    const target = resolveNotificationTarget(
      createNotificationTestPlan({
        actor: "unknown-dev",
        commitAuthorEmail: "author@example.com"
      }),
      createEmptyNotificationConfig()
    );

    expect(target.emails).toEqual(["author@example.com"]);
  });
});
