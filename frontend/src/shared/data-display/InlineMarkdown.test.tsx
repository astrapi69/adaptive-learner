/**
 * Tests for InlineMarkdown — inline-only Markdown rendering for prompts /
 * labels (#647). Covers bold/italic/code/link rendering, plain-text
 * pass-through, HTML escaping (XSS), and block-syntax unwrapping.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import InlineMarkdown from "./InlineMarkdown";

describe("InlineMarkdown", () => {
  it("renders **bold** as <strong>", () => {
    const { container } = render(
      <InlineMarkdown>{"el **día**"}</InlineMarkdown>,
    );
    const strong = container.querySelector("strong");
    expect(strong?.textContent).toBe("día");
    expect(container.textContent).toBe("el día");
  });

  it("renders *italic* as <em>", () => {
    const { container } = render(<InlineMarkdown>{"un *gato*"}</InlineMarkdown>);
    expect(container.querySelector("em")?.textContent).toBe("gato");
  });

  it("renders `code` as <code>", () => {
    const { container } = render(
      <InlineMarkdown>{"run `print()`"}</InlineMarkdown>,
    );
    expect(container.querySelector("code")?.textContent).toBe("print()");
  });

  it("renders a [link](url) as a safe new-tab anchor", () => {
    const { container } = render(
      <InlineMarkdown>{"see [docs](https://example.com)"}</InlineMarkdown>,
    );
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://example.com");
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("passes plain text through unchanged (no markup added)", () => {
    const { container } = render(
      <InlineMarkdown>{"el día y la noche"}</InlineMarkdown>,
    );
    expect(container.textContent).toBe("el día y la noche");
    expect(container.querySelector("strong, em, code, a, h1, ul")).toBeNull();
  });

  it("escapes raw HTML instead of rendering it (XSS-safe)", () => {
    const { container } = render(
      <InlineMarkdown>{"<script>alert(1)</script>"}</InlineMarkdown>,
    );
    // No live <script> element is created; the markup shows as text.
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("renders an inline <b> tag as escaped text, not bold", () => {
    const { container } = render(
      <InlineMarkdown>{"<b>x</b>"}</InlineMarkdown>,
    );
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<b>x</b>");
  });

  it("unwraps a block heading to plain text (no <h1>)", () => {
    const { container } = render(
      <InlineMarkdown>{"# Title"}</InlineMarkdown>,
    );
    expect(container.querySelector("h1")).toBeNull();
    expect(container.textContent).toBe("Title");
  });

  it("does not wrap inline content in a block <p>", () => {
    const { container } = render(<InlineMarkdown>{"**hi**"}</InlineMarkdown>);
    expect(container.querySelector("p")).toBeNull();
  });
});
