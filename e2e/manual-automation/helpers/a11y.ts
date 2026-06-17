/**
 * axe-core helper for the manual-automation a11y session (#616, S7).
 *
 * Wraps ``@axe-core/playwright`` with the project's triage contract
 * (mirrors ``e2e/smoke/a11y-audit.spec.ts``): scan WCAG 2.0/2.1 A + AA,
 * return only the violations not in a documented per-route allowlist. The
 * allowlist only ever shrinks and every entry needs an issue reference.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * Documented, pre-existing cosmetic violations tolerated per route by axe
 * rule id. Empty by design — populate ONLY from a real run, each entry
 * with an issue reference. Example: ``"/anki": ["color-contrast"], // #NNN``.
 */
export const A11Y_KNOWN_ISSUES: Record<string, string[]> = {
  // Empty by design. The former "/lesson": ["link-name"] entry (#616)
  // was fixed in #622 — the brand link is `display:none`'d to its icon in
  // the lesson-compact nav, so it now carries a constant aria-label.
};

/** Run axe on the current page + assert no unexpected violations. */
export async function expectNoA11yViolations(
  page: Page,
  route: string,
): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const allow = A11Y_KNOWN_ISSUES[route] ?? [];
  const unexpected = results.violations.filter((v) => !allow.includes(v.id));
  const summary = unexpected
    .map(
      (v) =>
        `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))\n    ${v.helpUrl}`,
    )
    .join("\n");

  expect(
    unexpected,
    `axe found ${unexpected.length} unexpected violation(s) on ${route}:\n${summary}`,
  ).toEqual([]);
}
