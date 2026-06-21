import { describe, expect, it } from "vitest";

import { maskSecret } from "./maskSecret";

describe("maskSecret", () => {
  it("reveals only the first 4 and last 4 characters", () => {
    expect(maskSecret("AIzaSyA-secret-1234567f3k")).toBe("AIza…7f3k");
  });

  it("works for a long Anthropic key", () => {
    const key = "sk-ant-" + "a".repeat(90) + "WXYZ";
    expect(maskSecret(key)).toBe("sk-a…WXYZ");
  });

  it("trims surrounding whitespace before masking", () => {
    expect(maskSecret("  AIzaSyABCDEF1234  ")).toBe("AIza…1234");
  });

  it("fully masks short secrets (<= 8 chars) without overlap", () => {
    expect(maskSecret("short")).toBe("•••••");
    expect(maskSecret("12345678")).toBe("••••••••");
  });

  it("returns null for empty / nullish input", () => {
    expect(maskSecret("")).toBeNull();
    expect(maskSecret("   ")).toBeNull();
    expect(maskSecret(null)).toBeNull();
    expect(maskSecret(undefined)).toBeNull();
  });
});
