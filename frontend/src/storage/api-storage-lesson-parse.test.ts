/**
 * #3393 - API-mode lesson reads go through the engine's ``parseLesson``
 * with the set's context, as Dexie-mode reads do (``content-loader-read``).
 *
 * The fixture is the shape the backend really serves: its Pydantic model
 * emits every optional field, so a lesson without its own language pair
 * arrives with ``target_language: null`` and a ``from_cards`` matching
 * with ``pairs: null`` (verified against alc-psychology
 * ``psych-rhetorik/01-ethos-pathos-logos.json`` on the issue).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getLesson, listSets } = vi.hoisted(() => ({
  getLesson: vi.fn(),
  listSets: vi.fn(),
}));

vi.mock("../api/client", () => ({
  api: { contentLoader: { getLesson, listSets } },
}));

import { _resetSetContextCacheForTests, apiStorage } from "./api-storage";

const SOURCE = "astrapi69/alc-psychology";
const SET_ID = "psych-rhetorik";

function servedLesson(over: Record<string, unknown> = {}) {
  return {
    id: "01-ethos-pathos-logos",
    title: "Ethos, Pathos, Logos",
    description: null,
    target_language: null,
    source_language: null,
    domain: null,
    estimated_minutes: 5,
    cards: [
      { id: "card-ethos", front: "Ethos", back: "Glaubwürdigkeit", notes: null, image: null, tags: [] },
      { id: "card-pathos", front: "Pathos", back: "Emotion", notes: null, image: null, tags: [] },
      { id: "card-logos", front: "Logos", back: "Argument", notes: null, image: null, tags: [] },
    ],
    steps: [
      { id: "theory-1", type: "theory", title: null, body: "Drei Überzeugungsmittel.", exercise: null },
      {
        id: "ex-match",
        type: "exercise",
        title: null,
        body: null,
        exercise: {
          id: "ex-match",
          type: "matching",
          prompt: "Ordne zu.",
          card_ids: ["card-ethos", "card-pathos", "card-logos"],
          distractors: [],
          from_cards: true,
          pairs: null,
          ext_payload: null,
        },
      },
    ],
    ...over,
  };
}

function setEntry(over: Record<string, unknown> = {}) {
  return {
    source: SOURCE,
    id: SET_ID,
    title: "Rhetorik",
    language: "de",
    target_language: "de",
    source_language: "de",
    domain: "psychology",
    cached_version: "1.0.0",
    ...over,
  };
}

/** The real ``GET .../sets`` shape (``ContentSetsList``), not a bare array. */
function listing(sets: Array<Record<string, unknown>>) {
  return { sets, sources: [{ source: SOURCE, branch: "main" }] };
}

beforeEach(() => {
  getLesson.mockReset();
  listSets.mockReset();
  _resetSetContextCacheForTests();
});

describe("ApiStorage.contentLoader.getLesson parses like Dexie mode (#3393)", () => {
  it("resolves a from_cards matching into the pairs its cards derive", async () => {
    getLesson.mockResolvedValue(servedLesson());
    listSets.mockResolvedValue(listing([setEntry()]));
    const lesson = await apiStorage.contentLoader.getLesson(SOURCE, SET_ID, "01.json");
    const matching = lesson.steps[1].exercise;
    expect(matching?.pairs).toEqual([
      { left: "Ethos", right: "Glaubwürdigkeit" },
      { left: "Pathos", right: "Emotion" },
      { left: "Logos", right: "Argument" },
    ]);
  });

  it("inherits the set's language pair and domain when the lesson carries none", async () => {
    getLesson.mockResolvedValue(servedLesson());
    listSets.mockResolvedValue(
      listing([
        setEntry({ id: "other", target_language: "fr", language: "fr" }),
        setEntry({ target_language: "es", language: "es", source_language: "de", domain: "language" }),
      ]),
    );
    const lesson = await apiStorage.contentLoader.getLesson(SOURCE, SET_ID, "01.json");
    expect([lesson.target_language, lesson.source_language, lesson.domain]).toEqual([
      "es",
      "de",
      "language",
    ]);
  });

  it("falls back to the lesson's own pair when its set is not listed", async () => {
    getLesson.mockResolvedValue(
      servedLesson({ target_language: "en", source_language: "de", domain: "psychology" }),
    );
    listSets.mockResolvedValue(listing([setEntry({ id: "other" })]));
    const lesson = await apiStorage.contentLoader.getLesson(SOURCE, SET_ID, "01.json");
    expect([lesson.target_language, lesson.steps[1].exercise?.pairs?.length]).toEqual(["en", 3]);
  });

  it("keeps a lesson's own language pair over the set's", async () => {
    getLesson.mockResolvedValue(
      servedLesson({ target_language: "en", source_language: "de", domain: "psychology" }),
    );
    listSets.mockResolvedValue(listing([setEntry({ target_language: "es", language: "es" })]));
    const lesson = await apiStorage.contentLoader.getLesson(SOURCE, SET_ID, "01.json");
    expect(lesson.target_language).toBe("en");
  });

  it("asks for the lesson with the caller's source, set and filename", async () => {
    getLesson.mockResolvedValue(servedLesson());
    listSets.mockResolvedValue(listing([setEntry()]));
    await apiStorage.contentLoader.getLesson(SOURCE, SET_ID, "01.json");
    expect(getLesson).toHaveBeenCalledWith(SOURCE, SET_ID, "01.json");
  });
});

describe("the set context costs no extra request per lesson (#3393)", () => {
  // GET .../sets fetches every source's manifest from GitHub; the lesson
  // runners read many lessons in a row, so the listing is reused.
  it("reuses one listing for consecutive lesson reads", async () => {
    getLesson.mockResolvedValue(servedLesson());
    listSets.mockResolvedValue(listing([setEntry()]));
    await apiStorage.contentLoader.getLesson(SOURCE, SET_ID, "01.json");
    await apiStorage.contentLoader.getLesson(SOURCE, SET_ID, "02.json");
    expect(listSets).toHaveBeenCalledTimes(1);
  });

  it("reuses the listing the set browser already loaded", async () => {
    getLesson.mockResolvedValue(servedLesson());
    listSets.mockResolvedValue(listing([setEntry({ target_language: "es", language: "es" })]));
    await apiStorage.contentLoader.listSets();
    const lesson = await apiStorage.contentLoader.getLesson(SOURCE, SET_ID, "01.json");
    expect(listSets).toHaveBeenCalledTimes(1);
    expect(lesson.target_language).toBe("es");
  });

  it("still serves a parsed lesson when the listing fails (offline)", async () => {
    getLesson.mockResolvedValue(
      servedLesson({ target_language: "de", source_language: "de", domain: "psychology" }),
    );
    listSets.mockRejectedValue(new Error("network down"));
    const lesson = await apiStorage.contentLoader.getLesson(SOURCE, SET_ID, "01.json");
    expect([lesson.target_language, lesson.steps[1].exercise?.pairs?.length]).toEqual(["de", 3]);
  });
});
