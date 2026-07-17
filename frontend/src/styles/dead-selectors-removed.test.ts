/**
 * Regression pin: the dead selectors removed in EXP-044 Tranche 1
 * (#1485) stay gone (audit T-A, docs/audits/global-css-analysis-2026-07-08.md).
 *
 * CSS has no referential integrity — a class selector with zero matching
 * markup trips no linter, so dead rules only accumulate. These eight
 * selectors were identified as dead in the #1467 audit (Layer 5) and each
 * was verified unused across ``frontend/src`` by ``git grep`` (no static
 * className hit, no dynamic template-literal stem composing it as a class)
 * before deletion. This test keeps them from silently reappearing via a
 * copy-paste or a revert of the wrong block.
 *
 * If this test fails because you intentionally RE-ADD one of these
 * classes for a real, rendered component: delete the entry here in the
 * same change and make sure the class is actually used in markup.
 */

import {describe, expect, it} from "vitest";

import {readLegacyCssSum} from "./legacy-css-sum";


/**
 * True when ``.selector`` appears in ``css`` as a WHOLE class token (a
 * class selector or one of its state/pseudo variants), not merely as a
 * prefix of a longer class name. Avoids a dynamically-built ``RegExp``
 * (which the security lint rejects) by scanning for the literal ``.name``
 * and checking the following character is not part of an identifier.
 */
function definesSelector(css: string, selector: string): boolean {
    const needle = `.${selector}`;
    let from = 0;
    for (;;) {
        const idx = css.indexOf(needle, from);
        if (idx === -1) return false;
        const after = css.charAt(idx + needle.length);
        if (after === "" || !/[\w-]/.test(after)) return true;
        from = idx + needle.length;
    }
}

/** Selectors deleted in Tranche 1 — must not be redefined in global.css. */
const REMOVED_SELECTORS = [
    "btn-danger",
    "onboarding-header-row",
    "form-optional",
    "content-source-native",
    "content-share-extra",
    "content-share-placement-path",
    "lesson-summary-link",
    "analysis-cancel-link",
] as const;

describe("EXP-044 Tranche 1 dead selectors stay removed (#1485)", () => {
    const css = readLegacyCssSum();

    it.each(REMOVED_SELECTORS)(
        "does not define .%s in global.css + styles/legacy",
        (selector) => {
            expect(
                definesSelector(css, selector),
                `\`.${selector}\` was deleted as a dead selector in EXP-044 ` +
                    "Tranche 1 and must not reappear in global.css. If it is " +
                    "genuinely used again, remove it from REMOVED_SELECTORS in " +
                    "this test and confirm the class is rendered in markup.",
            ).toBe(false);
        },
    );
});
