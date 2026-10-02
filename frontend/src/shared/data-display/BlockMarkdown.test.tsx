/**
 * Tests for BlockMarkdown - multi-line author text (a reading passage) as
 * block Markdown (#3217). Pins that code blocks keep their lines inside
 * <pre>, paragraphs stay separate, single author line breaks survive, and
 * raw HTML is escaped.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BlockMarkdown from "./BlockMarkdown";

const FENCED = [
  "```jsx",
  "function Formular() {",
  "    return <form />;",
  "}",
  "```",
].join("\n");

describe("BlockMarkdown", () => {
  it("renders a fenced code block as <pre><code> with its lines intact", () => {
    const { container } = render(<BlockMarkdown>{FENCED}</BlockMarkdown>);
    const code = container.querySelector("pre > code");
    expect(code?.textContent).toBe(
      "function Formular() {\n    return <form />;\n}\n",
    );
  });

  it("keeps separate paragraphs as separate <p> elements", () => {
    const { container } = render(
      <BlockMarkdown>{"Erster Absatz.\n\nZweiter Absatz."}</BlockMarkdown>,
    );
    expect(container.querySelectorAll("p")).toHaveLength(2);
  });

  it.each([
    ["a single author line break", "Zeile eins\nZeile zwei"],
    ["an unfenced multi-line snippet", "const a = 1;\nconst b = 2;"],
  ])("preserves %s inside a paragraph", (_name, source) => {
    const { container } = render(<BlockMarkdown>{source}</BlockMarkdown>);
    const paragraph = container.querySelector("p");
    expect(paragraph?.textContent).toBe(source);
    expect(paragraph?.className).toContain("whitespace-pre-line");
  });

  it("escapes raw HTML instead of rendering it", () => {
    const { container } = render(
      <BlockMarkdown>{"<script>alert(1)</script>"}</BlockMarkdown>,
    );
    expect(container.querySelector("script")).toBeNull();
  });
});
