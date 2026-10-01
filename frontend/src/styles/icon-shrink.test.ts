/**
 * Lucide icons never shrink in a flex row (#3373).
 *
 * An SVG flex item has ``flex-shrink: 1`` and ``overflow: hidden``, so its
 * minimum width is 0: when the label next to it wraps, the icon is squeezed
 * below its ``size``. The statistics tiles showed two of four icons
 * undersized on every phone. happy-dom does not load the stylesheet, so
 * this pins the base-layer rule itself; lucide-react stamps ``class="lucide"``
 * on every icon.
 */

import { describe, expect, it } from "vitest";

import { readLegacyCssSum } from "./legacy-css-sum";

const CSS = readLegacyCssSum().replace(/\/\*[\s\S]*?\*\//g, "");

describe("lucide icon shrink reset (#3373)", () => {
  it("keeps lucide icons at their size inside the base layer", () => {
    const layers = [...CSS.matchAll(/@layer base\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]);
    const rule = layers.join("\n").match(/svg\.lucide\s*\{([^}]*)\}/);
    expect(rule, "no svg.lucide rule in a base layer").not.toBeNull();
    expect(rule![1]).toMatch(/flex-shrink:\s*0/);
  });
});
