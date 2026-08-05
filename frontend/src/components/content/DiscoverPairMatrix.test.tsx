/** Tests for the connected language-pair matrix wrapper (EXP-048 #2337). */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DiscoverPairMatrix from "./DiscoverPairMatrix";
import type { SearchableSet } from "../../lib/content/repos/search-index-loader";

vi.mock("../../hooks/ui/useI18n", () => ({
  useI18n: () => ({ t: (_k: string, fallback: string) => fallback, lang: "de" }),
}));
vi.mock("../../lib/content/language/language-names", () => ({
  languageDisplayName: (code: string) => code.toUpperCase(),
  // Flag-free in the component test (the flag mapping is unit-tested in
  // language-names.test.ts); keeps the label assertions deterministic.
  flaggedName: (code: string) => code.toUpperCase(),
}));

function makeSet(over: Partial<SearchableSet>): SearchableSet {
  return {
    id: "id",
    name: "Name",
    description: "",
    source_language: "de",
    target_language: "es",
    level: "a1",
    domain: "language",
    lesson_count: 10,
    card_count: 100,
    tags: [],
    ai_validated: false,
    trust_level: 0,
    book: null,
    updated_at: null,
    repo_url: "owner/repo",
    repo_name: "owner/repo",
    review_status: "authored",
    ...over,
  };
}

const SETS = [
  makeSet({ id: "1", source_language: "de", target_language: "es" }),
  makeSet({ id: "2", source_language: "de", target_language: "fr" }),
];

describe("DiscoverPairMatrix", () => {
  it("renders the populated pairs with formatted labels in the language entry", () => {
    render(
      <DiscoverPairMatrix
        sets={SETS}
        entry="language"
        activeSource="de"
        activeTarget=""
        onSelect={() => {}}
      />,
    );
    // Collapsed by default (#2359): expand, then the source group + target
    // buttons appear. The source is the group heading, so the button is
    // target-only.
    fireEvent.click(screen.getByTestId("discover-pair-matrix-trigger"));
    expect(screen.getByTestId("discover-pair-matrix-group-de")).toHaveTextContent(
      "DE",
    );
    expect(screen.getByTestId("discover-pair-matrix-de-es")).toHaveTextContent(
      "ES (1)",
    );
    expect(screen.getByTestId("discover-pair-matrix-de-fr")).toBeInTheDocument();
  });

  it("passes the clicked pair to onSelect", () => {
    const onSelect = vi.fn();
    render(
      <DiscoverPairMatrix
        sets={SETS}
        entry="language"
        activeSource="de"
        activeTarget=""
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByTestId("discover-pair-matrix-trigger"));
    fireEvent.click(screen.getByTestId("discover-pair-matrix-de-es"));
    expect(onSelect).toHaveBeenCalledWith({ source: "de", target: "es", count: 1 });
  });

  it("summarizes the active pair on the collapsed trigger when it is present", () => {
    render(
      <DiscoverPairMatrix
        sets={SETS}
        entry="language"
        activeSource="de"
        activeTarget="es"
        onSelect={() => {}}
      />,
    );
    expect(screen.getByTestId("discover-pair-matrix-trigger")).toHaveTextContent(
      "DE → ES",
    );
  });

  it("keeps the trigger neutral when the active target is not a populated pair", () => {
    render(
      <DiscoverPairMatrix
        sets={SETS}
        entry="language"
        activeSource="de"
        activeTarget=""
        onSelect={() => {}}
      />,
    );
    // "de + all targets" is not a pair; the trigger shows the neutral chooser.
    expect(screen.getByTestId("discover-pair-matrix-trigger")).toHaveTextContent(
      "Choose a language pair (2)",
    );
  });

  it("renders nothing in the knowledge entry", () => {
    const { container } = render(
      <DiscoverPairMatrix
        sets={SETS}
        entry="knowledge"
        activeSource="de"
        activeTarget=""
        onSelect={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="discover-pair-matrix"]')).toBeNull();
  });

  it("renders nothing when only a single pair is populated", () => {
    const { container } = render(
      <DiscoverPairMatrix
        sets={[makeSet({ source_language: "de", target_language: "es" })]}
        entry="language"
        activeSource="de"
        activeTarget=""
        onSelect={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="discover-pair-matrix"]')).toBeNull();
  });
});
