/**
 * Phase 58D — theme completeness validation.
 *
 * Every theme file MUST define the EXACT same set of canonical color
 * tokens — no theme is allowed to omit one and rely on a
 * light-fallthrough (the F1 bug class the audit found). theme-light is
 * the reference set; every other theme is diffed against it.
 */

import {readdirSync, readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";
import {describe, expect, it} from "vitest";

import {THEME_IDS} from "../../lib/themes";

const HERE = dirname(fileURLToPath(import.meta.url));

/** All ``--name`` declarations in a theme file (any value form). */
function declaredTokens(themeId: string): Set<string> {
    const css = readFileSync(resolve(HERE, `theme-${themeId}.css`), "utf-8");
    const names = new Set<string>();
    const re = /--([a-z0-9-]+):/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(css)) !== null) {
        names.add(m[1]);
    }
    return names;
}

const reference = declaredTokens("light");

describe("Phase 58D — theme system", () => {
    it("ships exactly the registered set of theme files", () => {
        const files = readdirSync(HERE)
            .filter((f) => f.startsWith("theme-") && f.endsWith(".css"))
            .map((f) => f.replace(/^theme-/, "").replace(/\.css$/, ""))
            .sort();
        expect(files).toEqual([...THEME_IDS].sort());
    });

    it("the reference (light) theme defines the full canonical set", () => {
        // Sanity floor: backgrounds(5) + text(4) + borders(3) +
        // interactive(4) + accent(5) + status(8) + exercise(4) +
        // star(1) + charts(6) + shadows(3) = 43.
        expect(reference.size).toBeGreaterThanOrEqual(43);
        for (const required of [
            "bg-primary",
            "bg-overlay",
            "fg-primary",
            "fg-inverse",
            "border-primary",
            "interactive-disabled",
            "accent",
            "accent-subtle",
            "success",
            "success-bg",
            "error",
            "warning",
            "info",
            "info-bg",
            "exercise-correct",
            "exercise-matched",
            "star",
            "chart-1",
            "chart-6",
            "shadow-card",
            "shadow-md",
        ]) {
            expect(reference.has(required), `light missing --${required}`).toBe(true);
        }
    });

    for (const id of THEME_IDS) {
        if (id === "light") continue;
        it(`theme=${id} defines exactly the canonical set (no missing / extra tokens)`, () => {
            const tokens = declaredTokens(id);
            const missing = [...reference].filter((t) => !tokens.has(t));
            const extra = [...tokens].filter((t) => !reference.has(t));
            expect(missing, `theme ${id} is missing tokens`).toEqual([]);
            expect(extra, `theme ${id} has tokens not in light`).toEqual([]);
        });
    }
});
