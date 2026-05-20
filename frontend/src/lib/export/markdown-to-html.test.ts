/**
 * Tests for the lightweight Markdown → HTML converter (Phase 16C).
 *
 * Covers only the subset the export renderer emits: headings,
 * paragraphs, lists with nesting, blockquotes, fenced code,
 * GFM tables, inline bold / italic / code, and HTML escaping.
 */

import {describe, expect, it} from "vitest";

import {markdownToHtml} from "./markdown-to-html";

describe("markdownToHtml", () => {
    it("renders ATX headings up to h6", () => {
        const html = markdownToHtml("# A\n## B\n### C\n#### D\n##### E\n###### F");
        expect(html).toContain("<h1>A</h1>");
        expect(html).toContain("<h2>B</h2>");
        expect(html).toContain("<h3>C</h3>");
        expect(html).toContain("<h4>D</h4>");
        expect(html).toContain("<h5>E</h5>");
        expect(html).toContain("<h6>F</h6>");
    });

    it("renders paragraphs separated by blank lines", () => {
        const html = markdownToHtml("Line A\nLine B\n\nLine C");
        expect(html).toContain("<p>Line A<br>Line B</p>");
        expect(html).toContain("<p>Line C</p>");
    });

    it("renders bold + italic + code inline markup", () => {
        const html = markdownToHtml(
            "This is **bold** and _italic_ with `code`.",
        );
        expect(html).toContain("<strong>bold</strong>");
        expect(html).toContain("<em>italic</em>");
        expect(html).toContain("<code>code</code>");
    });

    it("escapes HTML inside plain text", () => {
        const html = markdownToHtml("a <script>alert(1)</script> b");
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
    });

    it("renders horizontal rules", () => {
        const html = markdownToHtml("a\n\n---\n\nb");
        expect(html).toContain("<hr>");
    });

    it("renders fenced code blocks with language class", () => {
        const html = markdownToHtml("```json\n{\"k\":1}\n```");
        expect(html).toContain('<pre><code class="lang-json">{&quot;k&quot;:1}</code></pre>');
    });

    it("renders blockquotes joining consecutive > lines", () => {
        const html = markdownToHtml("> Line A\n> Line B\n\nout");
        expect(html).toContain("<blockquote>Line A<br>Line B</blockquote>");
        expect(html).toContain("<p>out</p>");
    });

    it("renders flat bullet lists", () => {
        const html = markdownToHtml("- a\n- b\n- c");
        expect(html).toContain("<ul>");
        expect(html).toContain("<li>a</li>");
        expect(html).toContain("<li>b</li>");
        expect(html).toContain("<li>c</li>");
    });

    it("renders nested bullet lists by indent", () => {
        const html = markdownToHtml("- root\n  - child\n    - grandchild");
        // Root <ul> with one <li> containing nested <ul>...
        expect(html).toMatch(/<ul><li>root<ul><li>child<ul><li>grandchild<\/li><\/ul><\/li><\/ul><\/li><\/ul>/);
    });

    it("renders GFM-style tables with thead + tbody", () => {
        const md = ["| H1 | H2 |", "|---|---|", "| A | B |", "| C | D |"].join("\n");
        const html = markdownToHtml(md);
        expect(html).toContain("<table>");
        expect(html).toContain("<th>H1</th>");
        expect(html).toContain("<td>A</td>");
        expect(html).toContain("<td>D</td>");
    });

    it("respects escaped pipes inside table cells", () => {
        const md = ["| H1 | H2 |", "|---|---|", "| With \\| pipe | x |"].join("\n");
        const html = markdownToHtml(md);
        expect(html).toContain("<td>With | pipe</td>");
    });
});
