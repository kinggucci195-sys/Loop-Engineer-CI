import nodemailer from "nodemailer";
import { loadEnv } from "@loopci/config";
import { createNotificationTestPlan } from "./notification-test-fixture";
import { sendEmailRepairPlanNotification } from "../email";

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn()
  }
}));

describe("email notifications", () => {
  it("requires SMTP settings before sending mail", async () => {
    await expect(
      sendEmailRepairPlanNotification(
        ["dev@example.com"],
        createNotificationTestPlan(),
        loadEnv({ NODE_ENV: "test" })
      )
    ).rejects.toThrow("LOOPCI_SMTP_HOST");
  });

  it("sends a repair-plan email through SMTP", async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    jest.mocked(nodemailer.createTransport).mockReturnValue({
      sendMail
    } as never);

    await sendEmailRepairPlanNotification(
      ["dev@example.com"],
      createNotificationTestPlan(),
      loadEnv({
        NODE_ENV: "test",
        LOOPCI_PUBLIC_URL: "https://loopci.example.com",
        LOOPCI_EMAIL_FROM: "loopci@example.com",
        LOOPCI_SMTP_HOST: "smtp.example.com",
        LOOPCI_SMTP_USER: "loopci@example.com",
        LOOPCI_SMTP_PASSWORD: "secret"
      })
    );

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "loopci@example.com",
        to: ["dev@example.com"],
        subject: "LoopCI: typecheck failure in kinggucci195-sys/loopci",
        text: expect.stringContaining("Fix this error"),
        html: expect.stringContaining("Fix this error")
      })
    );
  });
});
