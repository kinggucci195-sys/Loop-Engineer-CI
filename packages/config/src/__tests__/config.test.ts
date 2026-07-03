import { loadEnv } from "../index";

describe("loadEnv", () => {
  it("loads defaults for local development", () => {
    const env = loadEnv({});

    expect(env.PORT).toBe(4000);
    expect(env.LOOPCI_AI_PROVIDER).toBe("heuristic");
  });

  it("requires an OpenAI key when the OpenAI provider is selected", () => {
    expect(() => loadEnv({ LOOPCI_AI_PROVIDER: "openai" })).toThrow(
      "OPENAI_API_KEY"
    );
  });
});
