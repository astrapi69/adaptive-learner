import { describe, it, expect } from "vitest";

import { buildValidationMarkdown } from "./validation-markdown";

const HEADERS = {
  lesson: "Lesson",
  card: "Card",
  field: "Field",
  problem: "Problem",
  suggestion: "Suggestion",
};

describe("buildValidationMarkdown", () => {
  it("renders a table with one row per issue", () => {
    const md = buildValidationMarkdown({
      setName: "Spanisch A1",
      summaryLine: "Checked 120 cards, 1 with issues.",
      headers: HEADERS,
      allOkLine: "All cards passed.",
      rows: [
        {
          lessonTitle: "Lektion 3",
          cardLabel: "libro",
          field: "front",
          problem: "Artikel falsch",
          suggestion: "el libro",
        },
      ],
    });
    expect(md).toContain("# AI content check: Spanisch A1");
    expect(md).toContain("Checked 120 cards, 1 with issues.");
    expect(md).toContain("| Lesson | Card | Field | Problem | Suggestion |");
    expect(md).toContain("| Lektion 3 | libro | front | Artikel falsch | el libro |");
  });

  it("escapes pipes and collapses newlines in cells", () => {
    const md = buildValidationMarkdown({
      setName: "Set",
      summaryLine: "summary",
      headers: HEADERS,
      allOkLine: "ok",
      rows: [
        {
          lessonTitle: "L1",
          cardLabel: "a|b",
          field: "back",
          problem: "line1\nline2",
          suggestion: "x",
        },
      ],
    });
    expect(md).toContain("a\\|b");
    expect(md).toContain("line1 line2");
    expect(md).not.toMatch(/line1\nline2/);
  });

  it("emits the all-OK line instead of an empty table", () => {
    const md = buildValidationMarkdown({
      setName: "Set",
      summaryLine: "Checked 5 cards.",
      headers: HEADERS,
      allOkLine: "All cards passed.",
      rows: [],
    });
    expect(md).toContain("All cards passed.");
    expect(md).not.toContain("| --- |");
  });

  it("renders provenance meta lines under the heading (#940)", () => {
    const md = buildValidationMarkdown({
      setName: "Set",
      summaryLine: "Checked 5 cards.",
      headers: HEADERS,
      allOkLine: "All cards passed.",
      rows: [],
      metaLines: ["Checked with: Anthropic Claude (claude-x)", "Date: 2026-06-21"],
    });
    const lines = md.split("\n");
    expect(lines[0]).toBe("# AI content check: Set");
    expect(md).toContain("Checked with: Anthropic Claude (claude-x)");
    expect(md).toContain("Date: 2026-06-21");
    // Meta lines come before the summary.
    expect(md.indexOf("Checked with")).toBeLessThan(md.indexOf("Checked 5 cards."));
  });

  it("all-empty meta lines produce identical output to omitting them", () => {
    const base = {
      setName: "Set",
      summaryLine: "Checked 5 cards.",
      headers: HEADERS,
      allOkLine: "All cards passed.",
      rows: [],
    };
    const withEmpty = buildValidationMarkdown({ ...base, metaLines: ["", ""] });
    const without = buildValidationMarkdown(base);
    expect(withEmpty).toBe(without);
  });
});
