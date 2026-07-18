/**
 * #1817 — settings toggle-row checkboxes must render at one fixed size.
 *
 * Every settings toggle row uses the shared ``.form-row-toggle`` layout
 * primitive (``display: flex; justify-content: space-between``) with a
 * bare native ``<input type="checkbox">``. A native checkbox is a flex
 * item with the default ``flex-shrink: 1``, so a row with a wider
 * label/description column squeezes its checkbox and renders it smaller
 * than sibling rows (the visible bug: the Interface panel's "Show button
 * tooltips" and "Developer Mode" checkboxes came out at different sizes).
 *
 * The fix constrains the checkbox in the ONE shared class rather than
 * duplicating a size utility across ~13 call sites. This pins that the
 * rule stays there: a fixed 1rem square that never shrinks.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(join(HERE, "legacy", "04-onboarding.css"), "utf8");

/** Extract the declaration body of a CSS rule by its exact selector. */
function ruleBody(css: string, selector: string): string | null {
  const at = css.indexOf(selector);
  if (at === -1) return null;
  const open = css.indexOf("{", at + selector.length);
  const close = css.indexOf("}", open + 1);
  if (open === -1 || close === -1) return null;
  // Guard against matching a longer selector that merely starts with `selector`:
  // everything between the found selector and `{` must be whitespace.
  if (css.slice(at + selector.length, open).trim() !== "") return null;
  return css.slice(open + 1, close);
}

describe("#1817 — shared toggle-checkbox sizing", () => {
  it("constrains the checkbox inside .form-row-toggle", () => {
    const body = ruleBody(CSS, '.form-row-toggle input[type="checkbox"]');
    expect(body).not.toBeNull();
  });

  it("stops the checkbox from shrinking (flex: none / flex-shrink: 0)", () => {
    const body = ruleBody(CSS, '.form-row-toggle input[type="checkbox"]') ?? "";
    const noShrink = /flex\s*:\s*none/.test(body) || /flex-shrink\s*:\s*0/.test(body);
    expect(noShrink).toBe(true);
  });

  it("pins a fixed square size on the checkbox", () => {
    const body = ruleBody(CSS, '.form-row-toggle input[type="checkbox"]') ?? "";
    expect(/width\s*:/.test(body)).toBe(true);
    expect(/height\s*:/.test(body)).toBe(true);
  });

  it("neutralises the inherited text-input padding (cross-browser inflation)", () => {
    // The global `input {...}` base rule bleeds `padding: var(--space-2)
    // var(--space-3)` onto checkboxes; Firefox/Safari apply it to the
    // native control and inflate it. This block sits in @layer legacy,
    // which wins over @layer base, so `padding: 0` cancels it.
    const body = ruleBody(CSS, '.form-row-toggle input[type="checkbox"]') ?? "";
    expect(/padding\s*:\s*0/.test(body)).toBe(true);
  });
});
