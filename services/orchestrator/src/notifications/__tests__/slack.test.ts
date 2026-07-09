import { loadEnv } from "@loopci/config";
import { createNotificationTestPlan } from "./notification-test-fixture";
import { sendSlackRepairPlanNotification } from "../slack";

describe("Slack notifications", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("posts a repair card with owner, risk, diagnosis, and fix actions", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));
    const env = loadEnv({
      NODE_ENV: "test",
      LOOPCI_PUBLIC_URL: "https://loopci.example.com"
    });

    await sendSlackRepairPlanNotification(
      "https://hooks.slack.com/services/example",
      createNotificationTestPlan(),
      env
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.text).toContain("typecheck failure");
    expect(JSON.stringify(body.blocks)).toContain("platform-team");
    expect(JSON.stringify(body.blocks)).toContain("codeowners");
    expect(body.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "actions",
          elements: expect.arrayContaining([
            expect.objectContaining({
              text: expect.objectContaining({ text: "Fix this error" }),
              url: "https://loopci.example.com/actions/plans/plan-1/request-fix"
            }),
            expect.objectContaining({
              text: expect.objectContaining({ text: "View diagnosis" }),
              url: "https://loopci.example.com/plans/plan-1"
            })
          ])
        })
      ])
    );
  });

  it("throws when Slack rejects the card", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("bad card", { status: 400 }));

    await expect(
      sendSlackRepairPlanNotification(
        "https://hooks.slack.com/services/example",
        createNotificationTestPlan(),
        loadEnv({ NODE_ENV: "test" })
      )
    ).rejects.toThrow("Slack notification failed");
  });
});
