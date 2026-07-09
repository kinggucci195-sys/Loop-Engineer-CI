import { loadEnv } from "@loopci/config";
import { createNotificationTestPlan } from "./notification-test-fixture";
import { sendTeamsRepairPlanNotification } from "../teams";

describe("Teams notifications", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("posts an adaptive card with diagnosis and fix actions", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));
    const env = loadEnv({
      NODE_ENV: "test",
      LOOPCI_PUBLIC_URL: "https://loopci.example.com"
    });

    await sendTeamsRepairPlanNotification(
      "https://teams.example.com/webhook",
      createNotificationTestPlan(),
      env
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(JSON.stringify(body.attachments[0].content.body)).toContain(
      "platform-team"
    );
    expect(JSON.stringify(body.attachments[0].content.body)).toContain(
      "codeowners"
    );
    expect(body.attachments[0].content.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Fix This Error",
          url: "https://loopci.example.com/actions/plans/plan-1/request-fix"
        }),
        expect.objectContaining({
          title: "View Diagnosis",
          url: "https://loopci.example.com/plans/plan-1"
        })
      ])
    );
  });

  it("throws when Teams rejects the card", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("bad card", { status: 400 }));

    await expect(
      sendTeamsRepairPlanNotification(
        "https://teams.example.com/webhook",
        createNotificationTestPlan(),
        loadEnv({ NODE_ENV: "test" })
      )
    ).rejects.toThrow("Teams notification failed");
  });
});
