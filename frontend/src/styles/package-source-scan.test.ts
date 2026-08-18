/**
 * Guard: every package whose dist the dead-classname gate scans is also
 * registered with Tailwind via ``@source`` (#2587).
 *
 * Two halves of one contract, and they were out of step:
 *
 *   - ``PACKAGE_CONSUMER_FILES`` in ``scripts/check-dead-classnames.py``
 *     proves the app-styled classNames a package renders have a CSS rule.
 *   - ``@source`` in ``tailwind.css`` makes the plain Tailwind UTILITIES
 *     the same package renders actually get generated.
 *
 * Tailwind v4's automatic content detection honours .gitignore and
 * therefore never descends into ``node_modules``. Without an explicit
 * ``@source``, a utility used ONLY by a package is silently not emitted.
 * That went unnoticed for a long time for the worst possible reason:
 * every other package utility (``rounded-app``, ``bg-accent-hover``, ...)
 * happened to be used somewhere under ``frontend/src`` too, so it was
 * emitted for an unrelated reason. ``min-h-4`` — used by no file under
 * ``frontend/src`` — was the single spot where that coincidence ran out,
 * which is how #2587 surfaced. The packages were styled by coincidence,
 * not by construction (the "zufaellige Uebereinstimmung" lesson, #2265).
 *
 * So the invariant worth pinning is not "min-h-4 exists" (that would pin
 * the symptom); it is the LOCKSTEP: adding a package to the gate without
 * adding its ``@source`` re-opens the same hole for the next package.
 *
 * Fail-closed by construction: the package list is READ from the Python
 * gate rather than restated here, and an empty parse is an explicit
 * failure — "found no packages" must never read as "all packages are
 * registered" (gate-test contract, points 3 + 4).
 *
 * Inventory + rationale: docs/development/package-classname-consumers.md
 */

import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe, expect, it} from "vitest";

const TAILWIND_CSS = resolve(__dirname, "tailwind.css");
const BASE_CSS = resolve(__dirname, "legacy/01-base.css");
const GATE_SCRIPT = resolve(
    __dirname,
    "../../../scripts/check-dead-classnames.py",
);

/** Strip CSS block comments, preserving line count for readable failures. */
function stripComments(css: string): string {
    return css.replace(/\/\*[\s\S]*?\*\//g, (match) =>
        match.replace(/[^\n]/g, " "),
    );
}

/**
 * The ``@astrapi69`` package names listed in the gate's
 * ``PACKAGE_CONSUMER_FILES``, read from the Python source itself so the
 * two halves cannot drift apart silently.
 */
function packagesScannedByGate(): string[] {
    const source = readFileSync(GATE_SCRIPT, "utf8");
    const block = source.match(
        /PACKAGE_CONSUMER_FILES\s*=\s*\[([\s\S]*?)\]/,
    )?.[1];
    if (!block) return [];
    return [...block.matchAll(/"@astrapi69"\s*\/\s*"([^"]+)"/g)].map(
        (match) => match[1],
    );
}

/** The package names registered with Tailwind via ``@source`` directives. */
function packagesRegisteredWithTailwind(): string[] {
    const css = stripComments(readFileSync(TAILWIND_CSS, "utf8"));
    return [
        ...css.matchAll(
            /@source\s+"[^"]*node_modules\/@astrapi69\/([^/"]+)[^"]*"\s*;/g,
        ),
    ].map((match) => match[1]);
}

describe("package-consumed Tailwind utilities are generated", () => {
    it("reads a non-empty package list from the dead-classname gate", () => {
        // Point 4 of the gate-test contract: report WHAT was measured. An
        // empty set would make every assertion below vacuously true, so an
        // unreadable/renamed PACKAGE_CONSUMER_FILES fails here instead of
        // passing silently downstream.
        const packages = packagesScannedByGate();
        expect(
            packages,
            "PACKAGE_CONSUMER_FILES could not be parsed from " +
                "scripts/check-dead-classnames.py — the lockstep check below " +
                "would pass vacuously. Fix the parse, do not delete this test.",
        ).not.toHaveLength(0);
        expect(packages).toContain("ai-key-vault-react");
        expect(packages).toContain("pwa-update-react");
    });

    it("registers every gate-scanned package with an @source directive", () => {
        const scanned = packagesScannedByGate();
        const registered = packagesRegisteredWithTailwind();
        const missing = scanned.filter((pkg) => !registered.includes(pkg));

        expect(
            missing,
            `These packages are scanned by scripts/check-dead-classnames.py ` +
                `but are NOT registered with Tailwind via @source in ` +
                `styles/tailwind.css: ${missing.join(", ")}. Any Tailwind ` +
                `utility used only by them will silently not be generated ` +
                `(#2587). Add an @source line per package.`,
        ).toEqual([]);
    });

    it("keeps @source free of packages the gate no longer scans", () => {
        // The reverse direction: a stale @source pointing at a removed
        // package is dead config that quietly stops proving anything.
        const scanned = packagesScannedByGate();
        const stale = packagesRegisteredWithTailwind().filter(
            (pkg) => !scanned.includes(pkg),
        );
        expect(stale).toEqual([]);
    });

    it("declares @source after the Tailwind utilities import", () => {
        // @source only affects what the utilities layer emits, so it has to
        // sit with the imports rather than drift into the @theme block below.
        const css = stripComments(readFileSync(TAILWIND_CSS, "utf8"));
        const utilitiesImport = css.indexOf('@import "tailwindcss/utilities');
        const firstSource = css.indexOf("@source");
        expect(utilitiesImport).toBeGreaterThan(-1);
        expect(firstSource).toBeGreaterThan(utilitiesImport);
    });
});

describe("akv-secret-toggle reveal button", () => {
    it("gives the kit's reveal toggle a hover affordance", () => {
        // The kit ships `akv-secret-toggle` with geometry only (absolute
        // right-2 flex h-7 w-7 ... rounded) and no hover state at all. The
        // app's own shared/forms/SecretInput.tsx is the reference treatment.
        const css = stripComments(readFileSync(BASE_CSS, "utf8"));
        expect(css).toMatch(/\.akv-secret-toggle:hover[^{]*\{[^}]*background:/);
    });

    it("drives the hover colour from a token, never a literal", () => {
        const css = stripComments(readFileSync(BASE_CSS, "utf8"));
        const hoverRule = css.match(
            /\.akv-secret-toggle:hover[^{]*\{([^}]*)\}/,
        )?.[1];
        expect(hoverRule).toBeTruthy();
        expect(hoverRule).toMatch(/var\(--[a-z-]+\)/);
        expect(hoverRule).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
    });

    it("leaves the disabled toggle without a hover state", () => {
        // `button:disabled` already carries not-allowed + reduced opacity
        // app-wide; a hover background on top of that would read as
        // interactive when it is not.
        const css = stripComments(readFileSync(BASE_CSS, "utf8"));
        expect(css).toMatch(/\.akv-secret-toggle:hover:not\(:disabled\)/);
    });
});
