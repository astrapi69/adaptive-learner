/**
 * #42 regression pin — exactly one scroll container for the whole app.
 *
 * ``#root`` is the single intended vertical scroll container; the viewport
 * elements (``html`` / ``body``) must NOT scroll. The trap this pins:
 * setting only ``overflow-x: hidden`` on ``html`` / ``body`` makes the
 * browser compute ``overflow-y: visible`` as ``auto`` (CSS overflow
 * computation rule), turning html AND body into vertical scroll containers
 * on top of ``#root`` — the multi-scrollbar condition reported on /content.
 *
 * The fix locks BOTH axes on the viewport elements (``overflow: hidden``)
 * so ``#root`` (``overflow-y: auto``) stays the sole scroller. This test
 * fails loudly if anyone reverts the viewport lock back to ``overflow-x``
 * only, or removes ``overflow-y: auto`` from ``#root``.
 */

import {describe, expect, it} from "vitest";

import {readLegacyCssSum} from "./legacy-css-sum";

const GLOBAL_CSS = readLegacyCssSum();

/**
 * Extracts the declaration body of the first CSS rule whose selector list
 * matches ``selector`` exactly (whitespace-normalized). Returns the text
 * between the braces, with comments stripped, lowercased.
 */
function ruleBody(selector: string): string {
    const stripped = GLOBAL_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = stripped.split("}");
    const wanted = selector.replace(/\s+/g, "");
    for (const rule of rules) {
        const braceIndex = rule.indexOf("{");
        if (braceIndex === -1) continue;
        const head = rule.slice(0, braceIndex).replace(/\s+/g, "");
        if (head === wanted) {
            return rule.slice(braceIndex + 1).toLowerCase();
        }
    }
    throw new Error(
        `Rule for selector "${selector}" not found in global.css + styles/legacy`,
    );
}

describe("#42 single scroll container", () => {
    it("#root is the app scroll container (overflow-y: auto)", () => {
        const body = ruleBody("#root");
        expect(body).toMatch(/overflow-y:\s*auto/);
    });

    it("html/body lock BOTH overflow axes so only #root scrolls", () => {
        const body = ruleBody("html,body");
        // The combined-axis lock. ``overflow-x: hidden`` alone is the bug
        // (forces overflow-y to compute as auto) — that must NOT be the form.
        expect(body).toMatch(/overflow:\s*hidden/);
        expect(body).not.toMatch(/overflow-x:\s*hidden\s*;/);
    });
});
