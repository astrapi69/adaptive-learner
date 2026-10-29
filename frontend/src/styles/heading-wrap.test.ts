/**
 * A page title never widens the page (#3406).
 *
 * An ``<h1>`` with one long word ("Wiederholungssitzung" at the UA h1 size is
 * about 356 px; content titles like set or lesson names can be longer) ran past
 * the gutter at 375 px and past the viewport at 360 px, so the page scrolled
 * sideways, which iOS WebKit answers by clipping the sticky footer's Next
 * button (#1834 class). #2761 wrapped only content titles and left fixed ones,
 * because ``overflow-wrap: anywhere`` alone broke "Wiederholungssitzun / g".
 * The base rule pairs it with ``hyphens: auto``: the browser breaks at a
 * syllable with the UI language's dictionary (``<html lang>`` follows the UI
 * language), and ``anywhere`` is only the fallback where no dictionary fits.
 * The same pair the exercise labels use. happy-dom loads no stylesheet, so
 * this pins the rule itself.
 */

import { describe, expect, it } from "vitest";

import { readLegacyCssSum } from "./legacy-css-sum";

const CSS = readLegacyCssSum().replace(/\/\*[\s\S]*?\*\//g, "");

describe("page title wrap (#3406)", () => {
  it("breaks a long word in an h1 instead of widening the page, in the base layer", () => {
    const layers = [...CSS.matchAll(/@layer base\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]);
    const rule = layers.join("\n").match(/:where\(h1\)\s*\{([^}]*)\}/);
    expect(rule, "no :where(h1) rule in a base layer").not.toBeNull();
    expect(rule![1]).toMatch(/overflow-wrap:\s*anywhere/);
    expect(rule![1]).toMatch(/hyphens:\s*auto/);
  });
});
