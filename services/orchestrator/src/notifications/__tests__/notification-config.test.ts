import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createEmptyNotificationConfig,
  loadNotificationConfig
} from "../notification-config";

describe("notification config", () => {
  it("returns an empty config when no file path is configured", async () => {
    await expect(loadNotificationConfig(undefined)).resolves.toEqual(
      createEmptyNotificationConfig()
    );
  });

  it("loads GitHub actor routing from JSON", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loopci-notifications-"));
    const filePath = join(dir, "notifications.json");
    await writeFile(
      filePath,
      JSON.stringify({
        defaultEmails: ["builds@example.com"],
        users: {
          "kinggucci195-sys": {
            email: "dev@example.com"
          }
        }
      }),
      "utf8"
    );

    const config = await loadNotificationConfig(filePath);

    expect(config.defaultEmails).toEqual(["builds@example.com"]);
    expect(config.users["kinggucci195-sys"]?.email).toBe("dev@example.com");
  });
});
