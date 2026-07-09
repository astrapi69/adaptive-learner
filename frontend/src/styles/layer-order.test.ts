/**
 * Guard: the ``@layer`` declaration in tailwind.css keeps ``legacy``
 * BEFORE ``utilities`` (EXP-044 Tranche 0, #1485).
 *
 * The whole EXP-044 cascade repair rests on one ordering fact: a later-
 * declared cascade layer beats an earlier one. Once the component-debt
 * block in global.css is wrapped tranche-by-tranche into
 * ``@layer legacy { ... }`` (Tranche 2), a Tailwind utility on the same
 * element only wins because ``utilities`` is declared AFTER ``legacy``.
 * If someone re-sorts the declaration line so that ``legacy`` lands after
 * ``utilities`` (or after ``components``), the cascade silently flips:
 * every wrapped legacy rule starts winning over authored utilities again,
 * re-creating the exact #1458/#1476/#1479 "utility silently defeated"
 * bug family — with no visual diff on an empty layer to warn anyone.
 *
 * This is a pure text assertion on the declaration line, deliberately
 * independent of any built CSS, so it fails the moment the order is wrong
 * regardless of whether the ``legacy`` layer currently holds any rules.
 *
 * If this test fails: do NOT reorder to make it pass blindly — the order
 * ``theme, base, legacy, components, utilities`` is load-bearing. Fix the
 * declaration back to that order.
 */

import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe, expect, it} from "vitest";

const TAILWIND_CSS = resolve(__dirname, "tailwind.css");

interface Declaration {
    layers: string[];
    line: number;
}

/**
 * Return the layer list of the first ``@layer name, name, ...;``
 * declaration statement in the stylesheet (comments stripped). The
 * block form ``@layer name { ... }`` is intentionally ignored — only the
 * ordering DECLARATION establishes precedence.
 */
function firstLayerDeclaration(css: string): Declaration | null {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, (m) =>
        m.replace(/[^\n]/g, " "),
    );
    // Match `@layer a, b, c;` — a statement (ends in `;`), not a block.
    const match = /@layer\s+([a-z0-9_-]+(?:\s*,\s*[a-z0-9_-]+)+)\s*;/i.exec(
        stripped,
    );
    if (!match) return null;
    const layers = match[1].split(",").map((s) => s.trim());
    const line = stripped.slice(0, match.index).split("\n").length;
    return {layers, line};
}

describe("tailwind.css cascade-layer order (EXP-044, #1485)", () => {
    it("declares a multi-name @layer ordering statement", () => {
        const css = readFileSync(TAILWIND_CSS, "utf8");
        const decl = firstLayerDeclaration(css);
        expect(
            decl,
            "Expected a `@layer a, b, ...;` ordering declaration in " +
                "tailwind.css that fixes the cascade-layer precedence.",
        ).not.toBeNull();
    });

    it("orders legacy strictly before components and utilities", () => {
        const css = readFileSync(TAILWIND_CSS, "utf8");
        const decl = firstLayerDeclaration(css);
        expect(decl).not.toBeNull();
        const {layers} = decl!;

        const legacy = layers.indexOf("legacy");
        const components = layers.indexOf("components");
        const utilities = layers.indexOf("utilities");

        expect(legacy, `\`legacy\` layer missing from ${JSON.stringify(layers)}`).toBeGreaterThanOrEqual(
            0,
        );
        expect(
            utilities,
            `\`utilities\` layer missing from ${JSON.stringify(layers)}`,
        ).toBeGreaterThanOrEqual(0);
        expect(
            components,
            `\`components\` layer missing from ${JSON.stringify(layers)}`,
        ).toBeGreaterThanOrEqual(0);

        expect(
            legacy < utilities,
            "`legacy` must be declared BEFORE `utilities` so authored " +
                "utilities win over wrapped legacy rules. Order was: " +
                JSON.stringify(layers),
        ).toBe(true);
        expect(
            legacy < components,
            "`legacy` must be declared BEFORE `components` so shadcn/component " +
                "layer rules win over wrapped legacy rules. Order was: " +
                JSON.stringify(layers),
        ).toBe(true);
    });

    it("keeps the exact canonical order theme, base, legacy, components, utilities", () => {
        const css = readFileSync(TAILWIND_CSS, "utf8");
        const decl = firstLayerDeclaration(css);
        expect(decl).not.toBeNull();
        expect(decl!.layers).toEqual([
            "theme",
            "base",
            "legacy",
            "components",
            "utilities",
        ]);
    });
});
