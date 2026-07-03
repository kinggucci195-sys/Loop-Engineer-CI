import { createLogger } from "../index";

describe("createLogger", () => {
  it("writes structured log lines", () => {
    const originalWrite = process.stdout.write;
    const write = jest.fn();
    process.stdout.write = write as unknown as typeof process.stdout.write;

    try {
      const logger = createLogger();
      logger.info({ planId: "plan-1" }, "Created plan");

      expect(write).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(String(write.mock.calls[0]?.[0]));
      expect(payload.level).toBe("info");
      expect(payload.context.planId).toBe("plan-1");
    } finally {
      process.stdout.write = originalWrite;
    }
  });
});
