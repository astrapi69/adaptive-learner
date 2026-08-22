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
 * audit). The tranche originally also removed every `api-key-*` /
 * `configured-provider-*` / `model-override-row-input` rule — WRONGLY:
 * their consumers are not in frontend/src but in the EXTERNAL package
 * `@astrapi69/ai-key-vault-react`, whose dist emits those classNames
 * (#2484 restored them; the AI-key settings rendered unstyled on the
 * deployments). A src-only grep is NOT a sufficient dead-verdict —
 * runtime packages emit classNames too. Only selectors re-verified
 * against every `node_modules/@astrapi69/<pkg>/dist` bundle as well
 * stay pinned here.
 * Deliberately NOT pinned: generic state classes (`is-ok`, `is-set`,
 * ...) — a future component may legitimately mint them.
 */
const REMOVED_SELECTORS_DEAD_CSS_TRANCHE = [
    "chat-transition-badge",
    "chat-transition-card",
    "chat-transition-header",
    "chat-transition-next",
    "chat-transition-summary",
    "metric-grid",
    "onboarding-skip-top",
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

/**
 * The modal shell classes moved into the shared Modal components
 * (src/shared/modal, #2729 — Option C): every consumer renders the
 * ModalOverlay/ModalCard/ModalTitle parts, whose styling is token-backed
 * Tailwind utilities. The legacy rules were deleted WITH the extraction;
 * neither the classnames nor the rules may reappear.
 */
const REMOVED_SELECTORS_MODAL_EXTRACTION = [
    "modal-overlay",
    "modal-card",
    "modal-title",
] as const;

describe("modal-extraction selectors stay removed (#2729, refs #1485)", () => {
    const css = readLegacyCssSum();

    it.each(REMOVED_SELECTORS_MODAL_EXTRACTION)(
        "does not define .%s in global.css + styles/legacy",
        (selector) => {
            expect(
                definesSelector(css, selector),
                `\`.${selector}\` was replaced by the shared Modal parts ` +
                    "(src/shared/modal, #2729) and its legacy rule deleted. " +
                    "Style the shared component instead of re-adding the rule.",
            ).toBe(false);
        },
    );
});

/**
 * The legacy button family moved to the shadcn `Button`
 * (components/ui/button.tsx, #2731 — Option C Slice 2): every consumer
 * renders `<Button>` / `buttonVariants()`, whose base carries the 44px
 * touch target (min-h-11) at all viewports. 02-buttons.css and every
 * `.X .btn` context rule were deleted with the migration; neither the
 * base classes nor the spinner may reappear as legacy rules.
 */
const REMOVED_SELECTORS_BTN_MIGRATION = [
    "btn",
    "btn-primary",
    "btn-secondary",
    "btn-spinner",
] as const;

describe("btn-family selectors stay removed (#2731, refs #1485)", () => {
    const css = readLegacyCssSum();

    it.each(REMOVED_SELECTORS_BTN_MIGRATION)(
        "does not define .%s in global.css + styles/legacy",
        (selector) => {
            expect(
                definesSelector(css, selector),
                `\`.${selector}\` was replaced by the shadcn Button ` +
                    "(components/ui/button.tsx, #2731) and its legacy rule " +
                    "deleted. Use a Button variant (or buttonVariants()) " +
                    "instead of re-adding the rule.",
            ).toBe(false);
        },
    );
});

/**
 * The widget-card family moved into the shared DashboardCard components
 * (src/shared/layout/DashboardCard, Option C, #1485): every consumer
 * renders DashboardCard / DashboardCardTitle, whose styling is
 * token-backed Tailwind utilities (including the mobile padding shrink).
 * The legacy rules were deleted WITH the extraction and may not reappear.
 */
const REMOVED_SELECTORS_DASHBOARD_CARD = [
    "dashboard-card",
    "dashboard-card-wide",
    "dashboard-card-title",
] as const;

describe("dashboard-card selectors stay removed (refs #1485)", () => {
    const css = readLegacyCssSum();

    it.each(REMOVED_SELECTORS_DASHBOARD_CARD)(
        "does not define .%s in global.css + styles/legacy",
        (selector) => {
            expect(
                definesSelector(css, selector),
                `\`.${selector}\` was replaced by the shared DashboardCard ` +
                    "parts (src/shared/layout/DashboardCard) and its legacy " +
                    "rule deleted. Style the shared component instead of " +
                    "re-adding the rule.",
            ).toBe(false);
        },
    );
});
