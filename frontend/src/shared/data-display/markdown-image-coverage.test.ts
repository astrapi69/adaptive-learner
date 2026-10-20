/**
 * Guard (#3803): every module that renders react-markdown routes its images
 * through {@link MarkdownImage}, so no Markdown surface lets a third-party
 * image load on render. A new surface that forgets ``img: MarkdownImage``
 * fails here, before a learner's browser contacts the image's host.
 *
 * The sources come in through ``import.meta.glob`` (raw text, nothing is
 * executed), which puts every scanned file into this test's module graph:
 * ``vitest --changed`` therefore selects the guard whenever any of them
 * changes, unlike a readFileSync scan (#1620). The glob takes ``.tsx`` only:
 * rendering Markdown needs JSX, and globbing the ``.ts`` barrels as well
 * made knip see them as imported and report 703 of their exports to the
 * dead-code ratchet (measured). The patterns are relative to this file:
 * the build-context guard (#3239) reads a root-absolute pattern as a path
 * outside the image's build stage.
 */

import { describe, expect, it } from "vitest";

const SOURCES = import.meta.glob<string>(
  ["../../**/*.tsx", "!../../**/*.test.tsx"],
  { query: "?raw", import: "default", eager: true },
);

/** A value import of react-markdown, i.e. a module that renders Markdown. */
const RENDERS_MARKDOWN = /^import\s+\w+\s+from\s+["']react-markdown["']/m;
const USES_IMAGE_RENDERER = /\bimg:\s*MarkdownImage\b/;

/** The surfaces #3803 named; the scan must see them, or it sees nothing. */
const KNOWN_SURFACES = [
  "../../components/lesson/steps/TheoryBody.tsx",
  "./BlockMarkdown.tsx",
  "../../components/exercises/feedback/ExerciseExplanation.tsx",
  "../../components/session/assistant-ui/AssistantUiThread.tsx",
  "../../pages/content/LearningRepo.tsx",
];

const surfaces = Object.keys(SOURCES)
  .filter((file) => RENDERS_MARKDOWN.test(SOURCES[file]))
  .sort();

describe("Markdown images go through MarkdownImage (#3803)", () => {
  it("scans the source tree and finds the known Markdown surfaces", () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(100);
    expect(surfaces).toEqual(expect.arrayContaining(KNOWN_SURFACES));
  });

  it.each(surfaces)("%s renders images with MarkdownImage", (file) => {
    expect(SOURCES[file]).toMatch(USES_IMAGE_RENDERER);
  });
});
