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

/**
 * Selectors deleted in the #2476 dead-CSS tranche (map from the #2452
 * audit) — mostly residue of the post-2026-07-08 Tailwind migration of
 * the AI-key settings UI. Each was verified unused across frontend/src
 * (no static className hit, no dynamic template-literal stem, testids
 * excluded) before deletion. Deliberately NOT pinned: the generic state
 * classes (`is-ok`, `is-set`, ...) that only appeared compounded with
 * these — a future component may legitimately mint them.
 */
const REMOVED_SELECTORS_DEAD_CSS_TRANCHE = [
    "chat-transition-badge",
    "chat-transition-card",
    "chat-transition-header",
    "chat-transition-next",
    "chat-transition-summary",
    "api-key-format-check",
    "api-key-format-error",
    "api-key-format-invalid",
    "api-key-format-valid",
    "api-key-input-wrap",
    "api-key-restore-link",
    "api-key-test-result",
    "api-key-active-badge",
    "api-key-external-hint",
    "api-key-row",
    "api-key-row-head",
    "api-key-row-input",
    "api-key-source",
    "api-key-source-env",
    "api-key-source-secrets_yaml",
    "api-key-status",
    "api-key-warning",
    "configured-provider-actions",
    "configured-provider-active",
    "configured-provider-model",
    "configured-provider-name",
    "configured-provider-preview",
    "configured-provider-row",
    "configured-providers-list",
    "configured-provider-status",
    "configured-provider-test-result",
    "metric-grid",
    "onboarding-skip-top",
    "model-override-row-input",
    "chat-message-cursor",
] as const;

describe("dead-CSS tranche selectors stay removed (#2476, refs #1485)", () => {
    const css = readLegacyCssSum();

    it.each(REMOVED_SELECTORS_DEAD_CSS_TRANCHE)(
        "does not define .%s in global.css + styles/legacy",
        (selector) => {
            expect(
                definesSelector(css, selector),
                `\`.${selector}\` was deleted as dead CSS in the #2476 ` +
                    "tranche and must not reappear. If it is genuinely used " +
                    "again, remove it from REMOVED_SELECTORS_DEAD_CSS_TRANCHE " +
                    "and confirm the class is rendered in markup.",
            ).toBe(false);
        },
    );
});
