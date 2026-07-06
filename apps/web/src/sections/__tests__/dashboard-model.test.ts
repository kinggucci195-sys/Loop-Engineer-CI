import {
  activeIncident,
  getActionablePlanCount,
  getDashboardTextCorpus,
  policyRows,
  repairQueue
} from "../dashboard-model";

describe("dashboard model", () => {
  it("surfaces memory as an engineer action signal", () => {
    expect(activeIncident.seenCount).toBeGreaterThan(1);
    expect(activeIncident.lastFixedBy).toBeTruthy();
    expect(activeIncident.lastSuccessfulRepair).toContain("Regenerate");
    expect(activeIncident.nextAction).toContain("draft");
  });

  it("counts only low-risk non-review plans as actionable", () => {
    expect(getActionablePlanCount()).toBe(2);
    expect(
      repairQueue.every((plan) => {
        if (plan.risk !== "low") {
          return plan.state === "review";
        }

        return true;
      })
    ).toBe(true);
  });

  it("keeps human approval as the policy authority", () => {
    expect(policyRows).toContainEqual(["Auto merge", "Off", "Human-owned"]);
  });

  it("keeps primary dashboard copy out of generic marketing language", () => {
    expect(getDashboardTextCorpus()).not.toMatch(
      /\b(AI|magic|revolutionary|autonomous|agentic)\b/i
    );
  });
});
