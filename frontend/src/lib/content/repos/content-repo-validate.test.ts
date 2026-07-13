/**
 * Unit tests for the content-repository validator (EXP-023 Phase A,
 * commit 2). Mocks ``fetch`` to drive each branch of the simplified check.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hasSuspiciousContent, validateUserRepo } from "./content-repo-validate";

const REF = { owner: "jane", repo: "content", branch: "main" };

const ROOT_MANIFEST = `
schema_version: "1.3"
sets:
  - id: fr-a1
    version: "1.0.0"
    lesson_count: 3
    path: sets/de/fr-a1
  - id: es-a1
    version: "1.0.0"
    lesson_count: 2
    path: sets/de/es-a1
`;

const SET_MANIFEST = `
metadata:
  lessons:
    - "01.json"
    - "02.json"
`;

const GOOD_LESSON = JSON.stringify({
  exercises: [{ type: "matching" }, { type: "cloze" }],
});

function mockFetchSequence(handler: (url: string) => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => handler(String(url))),
  );
}

function ok(body: string): Response {
  return { ok: true, status: 200, text: async () => body } as Response;
}
function notFound(): Response {
  return { ok: false, status: 404, text: async () => "" } as Response;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("validateUserRepo", () => {
  it("passes a well-formed repo and counts sets + lessons", async () => {
    mockFetchSequence((url) => {
      if (url.endsWith("/main/manifest.yaml")) return ok(ROOT_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/manifest.yaml")) return ok(SET_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/lessons/01.json")) return ok(GOOD_LESSON);
      return notFound();
    });
    const res = await validateUserRepo(REF, "");
    expect(res).toEqual({ ok: true, setCount: 2, lessonCount: 5 });
  });

  it("fails when the repo / manifest is missing (404)", async () => {
    mockFetchSequence(() => notFound());
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/not found/i);
  });

  it("fails on an incompatible schema major", async () => {
    mockFetchSequence((url) =>
      url.endsWith("manifest.yaml")
        ? ok(`schema_version: "2.0"\nsets:\n  - id: x\n    lesson_count: 1\n`)
        : notFound(),
    );
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/schema/i);
  });

  it("fails when no sets are listed", async () => {
    mockFetchSequence((url) =>
      url.endsWith("manifest.yaml") ? ok(`schema_version: "1.3"\nsets: []\n`) : notFound(),
    );
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/no sets/i);
  });

  it("fails on an unknown exercise_type", async () => {
    const badLesson = JSON.stringify({ exercises: [{ type: "mystery" }] });
    mockFetchSequence((url) => {
      if (url.endsWith("/main/manifest.yaml")) return ok(ROOT_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/manifest.yaml")) return ok(SET_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/lessons/01.json")) return ok(badLesson);
      return notFound();
    });
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/mystery/);
  });

  it("accepts the native multiple_choice type (repro: KNOWN_EXERCISE_TYPES was stale)", async () => {
    // Pre-existing bug: the sample gate never learned the v1.6 native type,
    // so a legitimate repo whose first lesson uses multiple_choice was
    // rejected as "Unknown exercise_type".
    const mcLesson = JSON.stringify({ exercises: [{ type: "multiple_choice" }] });
    mockFetchSequence((url) => {
      if (url.endsWith("/main/manifest.yaml")) return ok(ROOT_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/manifest.yaml")) return ok(SET_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/lessons/01.json")) return ok(mcLesson);
      return notFound();
    });
    const res = await validateUserRepo(REF, "");
    expect(res).toEqual({ ok: true, setCount: 2, lessonCount: 5 });
  });

  it("accepts the adopted extension type ext:al-categorization (#1579)", async () => {
    const extLesson = JSON.stringify({
      exercises: [{ type: "ext:al-categorization" }],
    });
    mockFetchSequence((url) => {
      if (url.endsWith("/main/manifest.yaml")) return ok(ROOT_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/manifest.yaml")) return ok(SET_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/lessons/01.json")) return ok(extLesson);
      return notFound();
    });
    const res = await validateUserRepo(REF, "");
    expect(res).toEqual({ ok: true, setCount: 2, lessonCount: 5 });
  });

  it("accepts the adopted extension type ext:al-error-correction (#1579)", async () => {
    const extLesson = JSON.stringify({
      exercises: [{ type: "ext:al-error-correction" }],
    });
    mockFetchSequence((url) => {
      if (url.endsWith("/main/manifest.yaml")) return ok(ROOT_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/manifest.yaml")) return ok(SET_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/lessons/01.json")) return ok(extLesson);
      return notFound();
    });
    const res = await validateUserRepo(REF, "");
    expect(res).toEqual({ ok: true, setCount: 2, lessonCount: 5 });
  });

  it("fails when no set has any lessons", async () => {
    mockFetchSequence((url) =>
      url.endsWith("manifest.yaml")
        ? ok(`schema_version: "1.3"\nsets:\n  - id: x\n    lesson_count: 0\n`)
        : notFound(),
    );
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/no lessons/i);
  });

  it("rejects lessons that carry executable content", async () => {
    const evil = JSON.stringify({
      exercises: [{ type: "matching" }],
      note: "<script>alert(1)</script>",
    });
    mockFetchSequence((url) => {
      if (url.endsWith("/main/manifest.yaml")) return ok(ROOT_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/manifest.yaml")) return ok(SET_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/lessons/01.json")) return ok(evil);
      return notFound();
    });
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/executable/i);
  });

  it("hasSuspiciousContent flags scripts / handlers / eval", () => {
    expect(hasSuspiciousContent("<script>x</script>")).toBe(true);
    expect(hasSuspiciousContent('a onerror="x"')).toBe(true);
    expect(hasSuspiciousContent("eval(1)")).toBe(true);
    expect(hasSuspiciousContent("bonjour = hello")).toBe(false);
  });

  it("sends a Bearer header when a token is given", async () => {
    const spy = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        ok(`schema_version: "1.3"\nsets: []\n`),
    );
    vi.stubGlobal("fetch", spy);
    await validateUserRepo(REF, "ghp_secret");
    const init = spy.mock.calls[0][1];
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer ghp_secret",
    });
  });
});

describe("failure classification: transient (I/O) vs structural (#1441)", () => {
  function rateLimited(): Response {
    return { ok: false, status: 429, text: async () => "" } as Response;
  }

  it("a manifest fetch that could not complete is transient (404)", async () => {
    mockFetchSequence(() => notFound());
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(false);
    expect(res.transient).toBe(true);
  });

  it("a rate-limited manifest fetch is transient (429)", async () => {
    mockFetchSequence(() => rateLimited());
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(false);
    expect(res.transient).toBe(true);
  });

  it("a rate-limited SAMPLE lesson fetch is transient (manifest read OK)", async () => {
    mockFetchSequence((url) => {
      if (url.endsWith("/main/manifest.yaml")) return ok(ROOT_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/manifest.yaml")) return ok(SET_MANIFEST);
      // The lesson fetch is throttled under a burst → transient, not invalid.
      return rateLimited();
    });
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(false);
    expect(res.transient).toBe(true);
  });

  it("a malformed-JSON lesson (fetched OK) is STRUCTURAL, not transient", async () => {
    mockFetchSequence((url) => {
      if (url.endsWith("/main/manifest.yaml")) return ok(ROOT_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/manifest.yaml")) return ok(SET_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/lessons/01.json")) return ok("{ not json");
      return notFound();
    });
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(false);
    expect(res.transient).toBeFalsy();
  });

  it("structural content failures are NOT transient (no sets / unknown type)", async () => {
    mockFetchSequence((url) =>
      url.endsWith("manifest.yaml") ? ok(`schema_version: "1.3"\nsets: []\n`) : notFound(),
    );
    const noSets = await validateUserRepo(REF, "");
    expect(noSets.ok).toBe(false);
    expect(noSets.transient).toBeFalsy();

    const badLesson = JSON.stringify({ exercises: [{ type: "mystery" }] });
    mockFetchSequence((url) => {
      if (url.endsWith("/main/manifest.yaml")) return ok(ROOT_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/manifest.yaml")) return ok(SET_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/lessons/01.json")) return ok(badLesson);
      return notFound();
    });
    const unknownType = await validateUserRepo(REF, "");
    expect(unknownType.ok).toBe(false);
    expect(unknownType.transient).toBeFalsy();
  });

  it("success carries no transient flag", async () => {
    mockFetchSequence((url) => {
      if (url.endsWith("/main/manifest.yaml")) return ok(ROOT_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/manifest.yaml")) return ok(SET_MANIFEST);
      if (url.endsWith("/sets/de/fr-a1/lessons/01.json")) return ok(GOOD_LESSON);
      return notFound();
    });
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(true);
    expect(res.transient).toBeFalsy();
  });
});
