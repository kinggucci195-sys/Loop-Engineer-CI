import { loadEnv } from "@loopci/config";
import { createNotificationTestPlan } from "./notification-test-fixture";
import {
  getFixRequestUrl,
  getPlanUrl,
  renderHtmlRepairPlan,
  renderPlainTextRepairPlan
} from "../render";

describe("repair-plan notification rendering", () => {
  it("renders public diagnosis and fix-request links", () => {
    const env = loadEnv({
      NODE_ENV: "test",
      LOOPCI_PUBLIC_URL: "https://loopci.example.com"
    });
    const plan = createNotificationTestPlan();

    expect(getPlanUrl(plan, env)).toBe(
      "https://loopci.example.com/plans/plan-1"
    );
    expect(getFixRequestUrl(plan, env)).toBe(
      "https://loopci.example.com/actions/plans/plan-1/request-fix"
    );
    expect(renderPlainTextRepairPlan(plan, env)).toContain("Fix this error");
    expect(renderPlainTextRepairPlan(plan, env)).toContain(
      "Owner: platform-team"
    );
    expect(renderPlainTextRepairPlan(plan, env)).toContain(
      "Owner source: codeowners"
    );
    expect(renderHtmlRepairPlan(plan, env)).toContain("Fix this error");
    expect(renderHtmlRepairPlan(plan, env)).toContain("platform-team");
  });

  it("falls back to the GitHub run URL when no public URL is configured", () => {
    const env = loadEnv({ NODE_ENV: "test" });
    const plan = createNotificationTestPlan();

    expect(getPlanUrl(plan, env)).toBe(plan.event.runUrl);
    expect(getFixRequestUrl(plan, env)).toBe(plan.event.runUrl);
  });
});
