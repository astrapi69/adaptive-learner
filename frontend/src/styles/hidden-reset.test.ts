/**
 * Regression pin for the tabbed-Settings flat-scroll bug.
 *
 * ``.settings-section`` / ``.settings-tabpanel`` set ``display: flex``.
 * An element-level author ``display`` declaration beats the UA
 * ``[hidden] { display: none }`` at equal specificity, so the HTML
 * ``hidden`` attribute was silently defeated and every tab panel
 * rendered at once (flat scroll) in a real browser. happy-dom does not
 * load global.css, so component tests' ``toBeVisible()`` checks could
 * not catch it. This pins the global ``[hidden]`` reset that restores
 * the attribute's meaning.
 */

import {describe, expect, it} from "vitest";

import {readLegacyCssSum} from "./legacy-css-sum";

// Strip /* */ comments so the rule's example in a comment isn't matched.
const CSS = readLegacyCssSum().replace(/\/\*[\s\S]*?\*\//g, "");

describe("global [hidden] reset", () => {
    it("forces display:none !important so the hidden attribute always wins", () => {
        // Match the bare `[hidden] { ... }` rule.
        const block = CSS.match(/\[hidden\]\s*\{([^}]*)\}/);
        expect(
            block,
            "no [hidden] rule found in global.css + styles/legacy",
        ).not.toBeNull();
        expect(block![1]).toMatch(/display:\s*none\s*!important/);
    });
});
