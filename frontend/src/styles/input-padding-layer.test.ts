/**
 * Guard: bare ``input`` element rules in the UNLAYERED part of
 * global.css must not declare ``padding`` (#1458).
 *
 * Unlayered author CSS beats every ``@layer``-ed declaration, so an
 * unlayered ``input { padding: ... }`` silently defeats ALL Tailwind
 * padding utilities on inputs (``pl-9``/``pr-10`` on the icon-carrying
 * search fields — LessonPicker, SearchField, ContentSearchBar). The
 * icon then overlaps the placeholder even though the component authors
 * the correct padding. Same cascade class as the #185 button reset:
 * element-level defaults belong in ``@layer base`` where explicit
 * utilities can win.
 *
 * If this test fails: move the ``padding`` declaration of the bare
 * input rule into an ``@layer base`` block instead of relaxing the
 * guard.
 */

import {describe, expect, it} from "vitest";

import {readLegacyCssSum} from "./legacy-css-sum";

interface FlaggedRule {
    selector: string;
    line: number;
}

/**
 * Walk the stylesheet, skipping ``@layer { ... }`` blocks (their
 * declarations lose to utilities by design) while descending into other
 * grouping at-rules (``@media`` etc., which stay unlayered). Returns
 * every unlayered rule whose selector list contains a BARE ``input``
 * element selector and whose body declares ``padding``.
 */
function findUnlayeredBareInputPadding(css: string): FlaggedRule[] {
    const flagged: FlaggedRule[] = [];
    // Strip comments (keep newlines for line numbers).
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, (m) =>
        m.replace(/[^\n]/g, " "),
    );

    const lineOf = (index: number): number =>
        stripped.slice(0, index).split("\n").length;

    function walk(start: number, end: number, inLayer: boolean): void {
        let i = start;
        while (i < end) {
            const braceOpen = stripped.indexOf("{", i);
            if (braceOpen === -1 || braceOpen >= end) return;
            const prelude = stripped.slice(i, braceOpen).trim();
            // Find the matching closing brace.
            let depth = 1;
            let j = braceOpen + 1;
            while (j < end && depth > 0) {
                if (stripped[j] === "{") depth += 1;
                else if (stripped[j] === "}") depth -= 1;
                j += 1;
            }
            const bodyStart = braceOpen + 1;
            const bodyEnd = j - 1;
            if (prelude.startsWith("@")) {
                const isLayer = /^@layer\b/.test(prelude);
                // Descend into grouping at-rules; a layer block marks
                // everything inside it as layered.
                walk(bodyStart, bodyEnd, inLayer || isLayer);
            } else if (!inLayer) {
                const selectors = prelude
                    .split(",")
                    .map((s) => s.trim().replace(/\s+/g, " "));
                const hasBareInput = selectors.includes("input");
                const body = stripped.slice(bodyStart, bodyEnd);
                if (hasBareInput && /(^|[\s;])padding\s*:/.test(body)) {
                    flagged.push({
                        selector: prelude.replace(/\s+/g, " "),
                        line: lineOf(i + stripped.slice(i).search(/\S/)),
                    });
                }
            }
            i = j;
        }
    }

    walk(0, stripped.length, false);
    return flagged;
}

describe("global.css input padding stays layerable (#1458)", () => {
    it("declares no padding on a bare input selector outside @layer", () => {
        const css = readLegacyCssSum();
        const flagged = findUnlayeredBareInputPadding(css);
        expect(
            flagged,
            "Unlayered `input { padding }` defeats every Tailwind padding " +
                "utility on inputs (pl-9/pr-10 on the icon search fields). " +
                "Move the padding into an @layer base block: " +
                JSON.stringify(flagged),
        ).toEqual([]);
    });

    it("keeps the input base padding available via @layer base", () => {
        const css = readLegacyCssSum();
        // The default padding must not simply vanish — inputs without
        // authored utilities still need it. Assert an @layer base block
        // declares padding for the input element.
        const layerBase = /@layer\s+base\s*\{[\s\S]*?\n\}/g;
        const blocks = css.match(layerBase) ?? [];
        const carriesInputPadding = blocks.some(
            (b) => /(^|[^.#\w-])input[\s,{]/.test(b) && /padding\s*:/.test(b),
        );
        expect(
            carriesInputPadding,
            "Expected an @layer base block in global.css to declare the " +
                "default input/textarea/select padding.",
        ).toBe(true);
    });
});
