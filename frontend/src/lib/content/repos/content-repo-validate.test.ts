/**
 * Unit tests for the content-repository validator (EXP-023 Phase A,
 * commit 2). Mocks ``fetch`` to drive each branch of the simplified check.
 *
 * #3243: the sampled lesson is judged with the app's shape layer and the
 * engine's rules, so every fixture here has the schema's shape
 * (``steps[].exercise``); the flat ``exercises:`` shape the old check read
 * exists in no lesson and the schema forbids it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  hasSuspiciousContent,
  repoValidationReasonText,
  validateUserRepo,
} from "./content-repo-validate";
import { SUPPORTED_EXTENSIONS } from "../validation/lesson-schema-validator";

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

/** One schema-valid exercise body per core type (the engine's per-type
 *  rules satisfied) and per adopted extension (the app's payload validator
 *  satisfied; the payloads are the renderer tests' fixtures). */
const CORE_BODIES: Record<string, Record<string, unknown>> = {
  matching: { pairs: [{ left: "Hund", right: "dog" }, { left: "Katze", right: "cat" }] },
  free_text: { accept: ["dog"] },
  word_tiles: { tiles: ["Je", "suis", "ici"] },
  picture_choice: {
    images: [
      { src: "a.png", label: "a", is_correct: "true" },
      { src: "b.png", label: "b" },
    ],
  },
  cloze: { sentence: "Je ___ ici.", blanks: [{ accept: ["suis"] }] },
  multiple_choice: { options: [{ text: "4", correct: true }, { text: "5" }] },
};

const EXT_PAYLOADS: Record<string, unknown> = {
  "ext:al-categorization": {
    categories: [
      { name: "Sichtzeichen", items: ["flache Hand", "Zeigefinger hoch"] },
      { name: "Hoerzeichen", items: ["Sitz", "Platz"] },
    ],
  },
  "ext:al-error-correction": {
    tokens: ["Der", "Hund", "folgt", "das", "Kommando"],
    error_index: 3,
    accept: ["dem", "einem"],
  },
  "ext:al-reading-comprehension": {
    passage: "Rex lief in den Garten und bellte den Brieftraeger an.",
    questions: [
      {
        prompt: "Wohin lief Rex?",
        type: "multiple_choice",
        options: [{ text: "In den Garten", correct: true }, { text: "Auf die Strasse" }],
      },
      { prompt: "Wie hiess der Hund?", type: "free_text", accept: ["Rex"] },
    ],
  },
  "ext:al-graded-quiz": {
    pass_threshold: 60,
    questions: [
      {
        prompt: "Was ist 2+2?",
        type: "multiple_choice",
        options: [{ text: "4", correct: true }, { text: "5" }],
        points: 2,
      },
      { prompt: "Synonym fuer schnell?", type: "free_text", accept: ["rasch"], points: 3 },
    ],
  },
  "ext:al-dictation": { audio: "assets/audio/bonjour.mp3", accept: ["Bonjour", "bonjour"] },
  "ext:al-image-description": {
    image: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
    accept: ["a cat"],
  },
  "ext:al-speak-and-record": { sentence: "Je suis ici." },
  "ext:al-audio-choice": {
    sentence: "Je ___ ici.",
    options: [
      { audio: "assets/audio/suis.mp3", is_correct: "true" },
      { audio: "assets/audio/es.mp3" },
      { audio: "assets/audio/sommes.mp3" },
    ],
  },
  "ext:al-audio-tiles": { audio: "assets/audio/je-suis-ici.mp3", tiles: ["Je", "suis", "ici"] },
  "ext:al-ordering": { items: ["Engage clutch", "Select gear", "Release clutch"] },
  "ext:al-parsons": {
    language: "python",
    lines: [
      { code: "def greet(name):", indent: 0 },
      { code: "if name:", indent: 1 },
      { code: "print(name)", indent: 2 },
    ],
  },
  "ext:al-hotspot": {
    src: "data:image/png;base64,AAAA",
    zones: [
      { shape: "rect", coords: { x: 10, y: 10, width: 20, height: 20 }, is_correct: "true" },
      { shape: "circle", coords: { cx: 70, cy: 70, radius: 15 } },
    ],
  },
};

function exerciseOf(type: string, index: number): Record<string, unknown> {
  const body = type.startsWith("ext:")
    ? { ext_payload: EXT_PAYLOADS[type] ?? {} }
    : (CORE_BODIES[type] ?? {});
  return { id: `ex-${index}`, type, prompt: "Do it", ...body };
}

/** A schema-valid lesson JSON with one exercise step per type; extension
 *  types are declared at major 1 unless ``declare`` says otherwise. */
function lessonJson(
  types: string[],
  options: { declare?: string[] | null; extra?: Record<string, unknown> } = {},
): string {
  const extensions = [...new Set(types.filter((t) => t.startsWith("ext:")))];
  const declare = options.declare === undefined ? extensions.map((t) => `${t}@1`) : options.declare;
  return JSON.stringify({
    id: "01",
    title: "Lesson",
    steps: [
      { id: "theory-1", type: "theory", body: "Intro" },
      ...types.map((type, i) => ({
        id: `step-${i}`,
        type: "exercise",
        exercise: exerciseOf(type, i),
      })),
    ],
    ...(declare && declare.length > 0 ? { requires_extensions: declare } : {}),
    ...(options.extra ?? {}),
  });
}

const GOOD_LESSON = lessonJson(["matching", "cloze"]);

function mockFetchSequence(handler: (url: string) => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => handler(String(url))),
  );
}

/** Serve the two manifests and ``lessonBody`` as the sampled lesson. */
function mockRepoWithLesson(lessonBody: string) {
  mockFetchSequence((url) => {
    if (url.endsWith("/main/manifest.yaml")) return ok(ROOT_MANIFEST);
    if (url.endsWith("/sets/de/fr-a1/manifest.yaml")) return ok(SET_MANIFEST);
    if (url.endsWith("/sets/de/fr-a1/lessons/01.json")) return ok(lessonBody);
    return notFound();
  });
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
    mockRepoWithLesson(GOOD_LESSON);
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
    expect(res.reason).toMatch(/schema version/i);
  });

  it("fails when no sets are listed", async () => {
    mockFetchSequence((url) =>
      url.endsWith("manifest.yaml") ? ok(`schema_version: "1.3"\nsets: []\n`) : notFound(),
    );
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/no sets/i);
  });

  // #3243 reproduction: a schema-valid lesson whose exercise uses an
  // extension this app has not adopted used to pass (the old check read a
  // shape no lesson has), so the repo got trust 1 and the learner met the
  // unsupported-type placeholder inside the lesson.
  it("fails on an extension type this app has not adopted (structural, #3243)", async () => {
    mockRepoWithLesson(lessonJson(["ext:acme-mystery"]));
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/ext:acme-mystery/);
    expect(res.transient).toBeUndefined();
    expect(res).toMatchObject({ setCount: 2, lessonCount: 5 });
  });

  it("fails on a type outside the core enum (the schema's verdict)", async () => {
    mockRepoWithLesson(lessonJson(["mystery"]));
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/steps\/1\/exercise\/type/);
    expect(res.transient).toBeUndefined();
  });

  it.each(Object.keys(CORE_BODIES))("accepts the core type %s", async (type) => {
    mockRepoWithLesson(lessonJson([type]));
    expect(await validateUserRepo(REF, "")).toEqual({ ok: true, setCount: 2, lessonCount: 5 });
  });

  it.each([...SUPPORTED_EXTENSIONS])(
    "accepts the adopted extension %s declared at major 1",
    async (type) => {
      mockRepoWithLesson(lessonJson([type]));
      expect(await validateUserRepo(REF, "")).toEqual({ ok: true, setCount: 2, lessonCount: 5 });
    },
  );

  it("accepts a lesson with theory steps only", async () => {
    mockRepoWithLesson(lessonJson([]));
    expect(await validateUserRepo(REF, "")).toEqual({ ok: true, setCount: 2, lessonCount: 5 });
  });

  it("treats an empty object as a structural failure", async () => {
    mockRepoWithLesson("{}");
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/required property/);
    expect(res.transient).toBeUndefined();
  });

  it("reports an adopted extension the lesson uses but does not declare", async () => {
    mockRepoWithLesson(lessonJson(["ext:al-ordering"], { declare: null }));
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/not declared in requires_extensions/);
  });

  it("checks every step, not only the first exercise", async () => {
    mockRepoWithLesson(lessonJson(["matching", "ext:acme-mystery"]));
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/ext:acme-mystery/);
  });

  it("refuses an adopted extension pinned at a major this app does not implement", async () => {
    mockRepoWithLesson(lessonJson(["ext:al-ordering"], { declare: ["ext:al-ordering@2"] }));
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/ext:al-ordering@2/);
  });

  it("reports the engine's semantic verdict on a shape-valid lesson", async () => {
    // a single-mode multiple_choice with two correct options
    const lesson = JSON.parse(lessonJson(["multiple_choice"]));
    lesson.steps[1].exercise.options = [{ text: "4", correct: true }, { text: "5", correct: true }];
    mockRepoWithLesson(JSON.stringify(lesson));
    const res = await validateUserRepo(REF, "");
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/exactly one option/);
    expect(res.transient).toBeUndefined();
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
    const evil = lessonJson(["matching"], { extra: { description: "<script>alert(1)</script>" } });
    mockRepoWithLesson(evil);
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

    const badLesson = lessonJson(["mystery"]);
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


describe("repoValidationReasonText (#3424)", () => {
  const german: Record<string, string> = {
    "content_repo.validation.reason.no_sets": "manifest.yaml enthält keine Sets.",
    "content_repo.validation.reason.unsupported_schema":
      "Nicht unterstützte Schema-Version {version}.",
    "content_repo.validation.reason.lesson_invalid":
      "Die erste Lektion des ersten Sets besteht die Prüfung nicht: {detail}",
  };
  const t = (key: string, fallback?: string) => german[key] ?? fallback ?? key;

  it.each([
    ["a plain code", { reasonCode: "no_sets" as const }, "manifest.yaml enthält keine Sets."],
    [
      "a code with a version",
      { reasonCode: "unsupported_schema" as const, reasonParams: { version: "3.0" } },
      "Nicht unterstützte Schema-Version 3.0.",
    ],
    [
      "a code with the engine verdict",
      { reasonCode: "lesson_invalid" as const, reasonParams: { detail: "steps/1: bad" } },
      "Die erste Lektion des ersten Sets besteht die Prüfung nicht: steps/1: bad",
    ],
    [
      "a code missing from the catalog (English fallback)",
      { reasonCode: "unreachable" as const },
      "Repository unreachable.",
    ],
    ["a result without a code (the English reason)", { reason: "Legacy text." }, "Legacy text."],
  ])("renders %s", (_label, result, expected) => {
    expect(repoValidationReasonText(result, t)).toBe(expected);
  });

  it("returns the code and the English reason from validateUserRepo", async () => {
    mockFetchSequence((url) =>
      url.endsWith("manifest.yaml") ? ok(`schema_version: "1.3"\nsets: []\n`) : notFound(),
    );
    const res = await validateUserRepo(REF, "");
    expect(res.reasonCode).toBe("no_sets");
    expect(res.reason).toBe("manifest.yaml lists no sets.");
  });
});
