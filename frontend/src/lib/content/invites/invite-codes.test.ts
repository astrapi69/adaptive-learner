import { describe, expect, it } from "vitest";

import {
  CODE_ALPHABET,
  buildInviteLink,
  evaluateInviteStatus,
  generateInviteCode,
  inviteCodeFilePath,
  isValidInviteCodeFormat,
  normalizeInviteCode,
  parseInviteInput,
  redeemStatusI18n,
  sanitizeCodePrefix,
  type InviteCodeFile,
} from "./invite-codes";

/** A deterministic index source: cycles through the given indices. */
function seq(...indices: number[]): (max: number) => number {
  let i = 0;
  return () => indices[i++ % indices.length];
}

function makeFile(overrides: Partial<InviteCodeFile> = {}): InviteCodeFile {
  return {
    code: "DEUTSCH-8X4K",
    repo: "coach/deutsch-b1",
    branch: "main",
    max_uses: 25,
    expires: null,
    note: "Klasse 8a",
    created: "2026-06-24T10:00:00.000Z",
    ...overrides,
  };
}

describe("CODE_ALPHABET", () => {
  it("excludes the confusable characters O/0 and I/1", () => {
    expect(CODE_ALPHABET).not.toContain("O");
    expect(CODE_ALPHABET).not.toContain("0");
    expect(CODE_ALPHABET).not.toContain("I");
    expect(CODE_ALPHABET).not.toContain("1");
  });

  it("is uppercase letters + digits only", () => {
    expect(CODE_ALPHABET).toMatch(/^[A-Z2-9]+$/);
  });
});

describe("sanitizeCodePrefix", () => {
  it("uppercases and strips non-alphanumerics", () => {
    expect(sanitizeCodePrefix("Deutsch B1!")).toBe("DEUTSCHB1");
  });

  it("returns empty string for nothing usable", () => {
    expect(sanitizeCodePrefix("  -- ")).toBe("");
    expect(sanitizeCodePrefix("")).toBe("");
  });

  it("caps the length at 12", () => {
    expect(sanitizeCodePrefix("ABCDEFGHIJKLMNOP")).toBe("ABCDEFGHIJKL");
  });
});

describe("generateInviteCode", () => {
  it("produces a code of the default random length with no prefix", () => {
    const code = generateInviteCode({}, seq(0));
    expect(code).toBe("AAAAAAAA"); // 8 × alphabet[0]
  });

  it("prepends a sanitised, hyphenated prefix", () => {
    const code = generateInviteCode({ prefix: "Deutsch" }, seq(0, 1, 2, 3));
    expect(code).toBe("DEUTSCH-ABCDABCD");
  });

  it("honours a custom random length, clamped to 4..16", () => {
    expect(generateInviteCode({ randomLength: 4 }, seq(0)).length).toBe(4);
    expect(generateInviteCode({ randomLength: 2 }, seq(0)).length).toBe(4);
    expect(generateInviteCode({ randomLength: 99 }, seq(0)).length).toBe(16);
  });

  it("only draws from the confusable-free alphabet (default crypto path)", () => {
    const code = generateInviteCode({ prefix: "MATHE" });
    const random = code.split("-")[1];
    for (const ch of random) expect(CODE_ALPHABET).toContain(ch);
  });

  it("self-validates its own output", () => {
    expect(isValidInviteCodeFormat(generateInviteCode({ prefix: "X" }))).toBe(true);
    expect(isValidInviteCodeFormat(generateInviteCode())).toBe(true);
  });
});

describe("normalizeInviteCode", () => {
  it("trims and uppercases", () => {
    expect(normalizeInviteCode("  deutsch-8x4k ")).toBe("DEUTSCH-8X4K");
  });
});

describe("isValidInviteCodeFormat", () => {
  it.each(["8X4KQ7MR", "DEUTSCH-8X4K", "MATHE-R2P7", "deutsch-8x4k"])(
    "accepts %s",
    (code) => {
      expect(isValidInviteCodeFormat(code)).toBe(true);
    },
  );

  it.each(["ab", "with space", "bad/char", "DE--FG", "-LEAD"])(
    "rejects %s",
    (code) => {
      expect(isValidInviteCodeFormat(code)).toBe(false);
    },
  );
});

describe("inviteCodeFilePath", () => {
  it("places the code under codes/ with a normalised name", () => {
    expect(inviteCodeFilePath("deutsch-8x4k")).toBe("codes/DEUTSCH-8X4K.json");
  });
});

describe("evaluateInviteStatus", () => {
  it("is ok for a fresh, open code", () => {
    expect(evaluateInviteStatus(makeFile())).toBe("ok");
  });

  it("is inactive when deactivated (even if otherwise valid)", () => {
    expect(
      evaluateInviteStatus(makeFile({ deactivated: true, expires: "2999-01-01" })),
    ).toBe("inactive");
  });

  it("is expired the day after an inclusive expiry date", () => {
    const file = makeFile({ expires: "2026-06-24" });
    expect(
      evaluateInviteStatus(file, { now: new Date("2026-06-24T23:00:00Z") }),
    ).toBe("ok");
    expect(
      evaluateInviteStatus(file, { now: new Date("2026-06-25T00:30:00Z") }),
    ).toBe("expired");
  });

  it("treats an unparseable/empty expiry as no expiry", () => {
    expect(evaluateInviteStatus(makeFile({ expires: "" }))).toBe("ok");
    expect(evaluateInviteStatus(makeFile({ expires: "not-a-date" }))).toBe("ok");
  });

  it("enforces max_uses only when a redemption count is supplied", () => {
    const file = makeFile({ max_uses: 2 });
    expect(evaluateInviteStatus(file)).toBe("ok"); // Dexie: count unknown
    expect(evaluateInviteStatus(file, { knownRedemptions: 1 })).toBe("ok");
    expect(evaluateInviteStatus(file, { knownRedemptions: 2 })).toBe("full");
  });

  it("never reports full for an unlimited (0) code", () => {
    expect(
      evaluateInviteStatus(makeFile({ max_uses: 0 }), { knownRedemptions: 999 }),
    ).toBe("ok");
  });

  it("prioritises inactive over expired over full", () => {
    const file = makeFile({
      deactivated: true,
      expires: "2000-01-01",
      max_uses: 1,
    });
    expect(evaluateInviteStatus(file, { knownRedemptions: 5 })).toBe("inactive");
  });
});

describe("redeemStatusI18n", () => {
  it.each(["expired", "inactive", "full"] as const)(
    "maps %s to a namespaced key",
    (status) => {
      const { key, fallback } = redeemStatusI18n(status);
      expect(key).toBe(`invitation_code.error.${status}`);
      expect(fallback.length).toBeGreaterThan(0);
    },
  );
});

describe("buildInviteLink", () => {
  it("encodes code + repo onto the /invite route", () => {
    expect(
      buildInviteLink("https://astrapi69.github.io/adaptive-learner", {
        code: "DEUTSCH-8X4K",
        repo: "coach/deutsch-b1",
      }),
    ).toBe(
      "https://astrapi69.github.io/adaptive-learner/invite?code=DEUTSCH-8X4K&repo=coach%2Fdeutsch-b1",
    );
  });

  it("normalises a trailing slash on the origin", () => {
    expect(
      buildInviteLink("https://x.test/", { code: "AB12", repo: "a/b" }),
    ).toContain("https://x.test/invite?");
  });

  it("includes a non-default branch only", () => {
    expect(
      buildInviteLink("https://x.test", { code: "AB12", repo: "a/b", branch: "main" }),
    ).not.toContain("branch=");
    expect(
      buildInviteLink("https://x.test", { code: "AB12", repo: "a/b", branch: "v2" }),
    ).toContain("branch=v2");
  });

  it("round-trips through parseInviteInput", () => {
    const link = buildInviteLink("https://x.test", {
      code: "MATHE-R2P7",
      repo: "coach/mathe",
      branch: "v2",
    });
    expect(parseInviteInput(link)).toEqual({
      code: "MATHE-R2P7",
      repo: "coach/mathe",
      branch: "v2",
    });
  });
});

describe("parseInviteInput", () => {
  it("parses a full URL", () => {
    expect(
      parseInviteInput(
        "https://astrapi69.github.io/adaptive-learner/invite?code=deutsch-8x4k&repo=coach/deutsch-b1",
      ),
    ).toEqual({ code: "DEUTSCH-8X4K", repo: "coach/deutsch-b1", branch: undefined });
  });

  it("parses a bare query string", () => {
    expect(parseInviteInput("code=MATHE-R2P7&repo=coach/mathe")).toEqual({
      code: "MATHE-R2P7",
      repo: "coach/mathe",
      branch: undefined,
    });
  });

  it("parses a bare code with no repo", () => {
    expect(parseInviteInput("  deutsch-8x4k ")).toEqual({ code: "DEUTSCH-8X4K" });
  });

  it("returns null for empty or invalid input", () => {
    expect(parseInviteInput("")).toBeNull();
    expect(parseInviteInput("ab")).toBeNull();
    expect(parseInviteInput("https://x.test/invite?repo=a/b")).toBeNull(); // no code
    expect(parseInviteInput("not a valid code")).toBeNull();
  });
});
