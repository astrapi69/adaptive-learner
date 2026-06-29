/**
 * ContentSetListView (#1240) — compact list rows.
 *
 * Pins the language-vs-knowledge distinction (via ``isKnowledgeDomain``):
 *  - a language set row shows the title PLUS the language codes,
 *  - a knowledge-domain set row shows ONLY the title (no codes).
 */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { ContentSetEntry } from "../../../storage/types";
import ContentSetListView from "./ContentSetListView";

function entry(over: Partial<ContentSetEntry>): ContentSetEntry {
  return {
    source: "astrapi69/adaptive-learner-content",
    branch: "main",
    id: "set-id",
    title: "Untitled",
    title_native: null,
    language: "en",
    target_language: "en",
    source_language: "de",
    level: "A1",
    domain: "language",
    version: "1.0.0",
    lesson_count: 5,
    description: null,
    tags: [],
    cover_image: null,
    cached_version: "1.0.0",
    update_available: false,
    ...over,
  };
}

function renderList(sets: ContentSetEntry[]) {
  render(
    <MemoryRouter>
      <ContentSetListView sets={sets} />
    </MemoryRouter>,
  );
}

describe("ContentSetListView", () => {
  it("renders one row per set", () => {
    renderList([
      entry({ id: "a", title: "Set A" }),
      entry({ id: "b", title: "Set B" }),
    ]);
    expect(screen.getByTestId("content-list-view")).toBeInTheDocument();
    expect(screen.getByTestId("content-list-set-a")).toHaveTextContent("Set A");
    expect(screen.getByTestId("content-list-set-b")).toHaveTextContent("Set B");
  });

  it("shows title + language codes for a language set", () => {
    renderList([
      entry({ id: "lang", title: "English A1", source_language: "de", target_language: "en", domain: "language" }),
    ]);
    const langs = screen.getByTestId("content-list-set-lang-langs");
    expect(langs).toHaveTextContent("de");
    expect(langs).toHaveTextContent("en");
  });

  it("shows ONLY the title for a knowledge-domain set (no language codes)", () => {
    renderList([
      entry({ id: "know", title: "Psychologie", domain: "psychology", source_language: "de", target_language: "de" }),
    ]);
    expect(screen.getByTestId("content-list-set-know")).toHaveTextContent("Psychologie");
    expect(screen.queryByTestId("content-list-set-know-langs")).not.toBeInTheDocument();
  });

  it("links each row to the single-set deep link", () => {
    renderList([entry({ id: "deep", title: "Deep" })]);
    expect(screen.getByTestId("content-list-set-deep")).toHaveAttribute(
      "href",
      "/content/set/deep",
    );
  });
});
