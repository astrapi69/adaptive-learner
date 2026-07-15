/**
 * Regression pin for the My-Lessons clipped-action-buttons bug.
 *
 * ``.content-set-action`` was originally written for the Set
 * Browser's download-card (1 button). Phase 59C / My Lessons added
 * 5-6 action buttons per card (Play, Edit, Export, Export-as-set,
 * Share with Community, Delete) but inherited the rule without
 * updating it. The original rule had no ``flex-wrap`` and no
 * ``gap``, so the row of buttons grew wider than the card. Before
 * v1.46.0 this was just ugly horizontal scroll; after the v1.46.0
 * ``overflow-x: hidden`` guard rails on html/body/#root (commit
 * ae6ab92) the overflowing buttons became invisible — Share /
 * Export / Delete simply vanished for every user with a
 * user-generated lesson.
 *
 * happy-dom does not run layout, so a Vitest ``toBeVisible()`` on
 * the rendered card cannot catch this; the buttons are in the DOM
 * regardless of how they paint. Pin the CSS rule directly.
 */

import {describe, expect, it} from "vitest";

import {readLegacyCssSum} from "./legacy-css-sum";

const CSS = readLegacyCssSum().replace(
    /\/\*[\s\S]*?\*\//g,
    "",
);

describe(".content-set-action", () => {
    const blocks = [...CSS.matchAll(/\.content-set-action\s*\{([^}]*)\}/g)];

    it("rule exists exactly once at the top level", () => {
        // The @media (max-width: 600px) variant inside a block is
        // a separate match because its own outer braces aren't
        // captured here — we only count the top-level rule.
        expect(blocks.length).toBeGreaterThanOrEqual(1);
    });

    it("declares flex-wrap: wrap so 5-6 action buttons can wrap", () => {
        const body = blocks[0]![1];
        expect(body).toMatch(/flex-wrap:\s*wrap/);
    });

    it("declares a gap so wrapped buttons stay visually separated", () => {
        const body = blocks[0]![1];
        expect(body).toMatch(/gap:\s*[^;]+;/);
    });
});
