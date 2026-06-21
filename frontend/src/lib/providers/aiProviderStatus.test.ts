import { describe, expect, it } from "vitest";

import {
  CORS_BLOCKED_PROVIDERS,
  isDesktopOnlyProvider,
  providerKeyStatus,
} from "./aiProviderStatus";

describe("providerKeyStatus", () => {
  it("is active when an app-managed key is stored", () => {
    expect(
      providerKeyStatus({
        hasKey: true,
        source: "settings",
        mode: "api",
        corsBlocked: false,
      }),
    ).toBe("active");
  });

  it("is empty when no key is configured", () => {
    expect(
      providerKeyStatus({
        hasKey: false,
        source: "none",
        mode: "api",
        corsBlocked: false,
      }),
    ).toBe("empty");
  });

  it("is external when the key comes from env or secrets.yaml", () => {
    expect(
      providerKeyStatus({
        hasKey: true,
        source: "env",
        mode: "api",
        corsBlocked: false,
      }),
    ).toBe("external");
    expect(
      providerKeyStatus({
        hasKey: true,
        source: "secrets_yaml",
        mode: "api",
        corsBlocked: false,
      }),
    ).toBe("external");
  });

  it("is desktop_only in Dexie mode for a CORS-blocked provider, even with a key", () => {
    expect(
      providerKeyStatus({
        hasKey: true,
        source: "settings",
        mode: "dexie",
        corsBlocked: true,
      }),
    ).toBe("desktop_only");
  });

  it("does NOT mark a CORS-blocked provider desktop_only in server mode", () => {
    expect(
      providerKeyStatus({
        hasKey: true,
        source: "settings",
        mode: "api",
        corsBlocked: true,
      }),
    ).toBe("active");
  });
});

describe("isDesktopOnlyProvider", () => {
  it("matches the CORS-blocked set (currently empty)", () => {
    expect(CORS_BLOCKED_PROVIDERS.size).toBe(0);
    expect(isDesktopOnlyProvider("openai")).toBe(false);
    expect(isDesktopOnlyProvider("anthropic")).toBe(false);
    expect(isDesktopOnlyProvider("gemini")).toBe(false);
  });
});
