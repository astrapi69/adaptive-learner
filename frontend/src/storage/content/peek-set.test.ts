/**
 * #3393 - the update peek reads incoming lessons the way the read path
 * does, through the engine's ``parseLesson`` with the set's context.
 *
 * Raw, a ``from_cards`` matching has no ``pairs``, so its element keys
 * (the pair lefts) were empty: the #2128 update guard then saw every
 * learner row on that exercise as lost, although the parsed lesson the
 * learner played carries exactly those keys.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { files } = vi.hoisted(() => ({ files: new Map<string, string>() }));

vi.mock("./content-loader-sources", () => ({
  DEFAULT_SOURCES: [{ source: "astrapi69/alc-psychology", branch: "main" }],
  tokenForSource: () => null,
  fetchText: async (_source: string, _branch: string, path: string) => {
    const text = files.get(path);
    if (text === undefined) throw new Error(`404 ${path}`);
    return text;
  },
}));

import { peekSetIdentities, peekSetLessons } from "./peek-set";

const SOURCE = "astrapi69/alc-psychology";

const REPO_MANIFEST = `
schema_version: '1.0'
name: Psychologie
sets:
  - id: psych-rhetorik
    title: Rhetorik
    path: sets/de/psych-rhetorik
    target_language: de
    source_language: de
    domain: psychology
    version: '1.0.0'
    lesson_count: 1
`.trim();

const SET_MANIFEST = `
schema_version: '1.0'
name: Rhetorik
sets:
  - id: psych-rhetorik
    title: Rhetorik
    target_language: de
    source_language: de
    domain: psychology
    version: '1.0.0'
    lesson_count: 1
metadata:
  lessons:
    - 01-ethos.json
`.trim();

const LESSON = JSON.stringify({
  id: "01-ethos",
  title: "Ethos, Pathos, Logos",
  cards: [
    { id: "card-ethos", front: "Ethos", back: "Glaubwürdigkeit" },
    { id: "card-pathos", front: "Pathos", back: "Emotion" },
  ],
  steps: [
    { id: "theory-1", type: "theory", body: "Zwei Überzeugungsmittel." },
    {
      id: "ex-match",
      type: "exercise",
      exercise: {
        id: "ex-match",
        type: "matching",
        prompt: "Ordne zu.",
        card_ids: ["card-ethos", "card-pathos"],
        from_cards: true,
      },
    },
  ],
});

beforeEach(() => {
  files.clear();
  files.set("manifest.yaml", REPO_MANIFEST);
  files.set("sets/de/psych-rhetorik/manifest.yaml", SET_MANIFEST);
  files.set("sets/de/psych-rhetorik/lessons/01-ethos.json", LESSON);
});

describe("peekSet parses incoming lessons like the read path (#3393)", () => {
  it("gives a from_cards matching the element keys its cards derive", async () => {
    const identities = await peekSetIdentities(SOURCE, "psych-rhetorik");
    const keys = identities.byLesson.get("01-ethos.json")?.get("ex-match");
    expect(keys ? [...keys].sort() : keys).toEqual(["Ethos", "Pathos"]);
  });

  it("keeps an unparseable lesson as a lesson without exercises", async () => {
    files.set("sets/de/psych-rhetorik/lessons/01-ethos.json", "{ not json");
    const lessons = await peekSetLessons(SOURCE, "psych-rhetorik");
    expect(lessons).toEqual([{ filename: "01-ethos.json", exercises: [] }]);
  });
});
