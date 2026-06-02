/**
 * Regression pin for the lesson-mode + landscape-mobile compact
 * navigation (UX: collapse the nav during lessons / landscape so
 * the content reclaims vertical space).
 *
 * happy-dom runs no layout, so a rendered-component test can't
 * observe the collapse. The behaviour is entirely CSS-driven off
 * the ``.is-lesson-compact`` modifier (set by useIsLessonActive)
 * and an ``(orientation: landscape) and (max-height: …)`` media
 * query — both pinned here directly.
 */

import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";
import {describe, expect, it} from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = readFileSync(resolve(HERE, "global.css"), "utf-8");
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, "");

describe("lesson-mode compact nav (.is-lesson-compact)", () => {
    it("forces the hamburger visible at any width during a lesson", () => {
        expect(CSS).toMatch(
            /\.app-nav\.is-lesson-compact\s+\.nav-hamburger\s*\{[^}]*display:\s*inline-flex/,
        );
    });

    it("drawers the links (hidden until .is-open) during a lesson", () => {
        const drawer = CSS.match(
            /\.app-nav\.is-lesson-compact\s+\.nav-links\s*\{([^}]*)\}/,
        );
        expect(drawer).not.toBeNull();
        expect(drawer![1]).toMatch(/display:\s*none/);
        expect(drawer![1]).toMatch(/position:\s*absolute/);
        expect(CSS).toMatch(
            /\.app-nav\.is-lesson-compact\s+\.nav-links\.is-open\s*\{[^}]*display:\s*flex/,
        );
    });

    it("keeps the compact bar short (min-height 48px)", () => {
        const bar = CSS.match(/\.app-nav\.is-lesson-compact\s*\{([^}]*)\}/);
        expect(bar).not.toBeNull();
        expect(bar![1]).toMatch(/min-height:\s*48px/);
    });
});

describe("landscape-mobile compact nav", () => {
    it("declares an orientation:landscape + short-height media query", () => {
        expect(CSS).toMatch(
            /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*600px\)/,
        );
    });

    it("forces the hamburger + drawer inside that query", () => {
        // Grab the landscape media block body and assert it collapses
        // the nav. Brace-balanced extraction would be overkill; a
        // forward slice from the query opener to the next @media is
        // enough to scope the assertions.
        const start = CSS.search(
            /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*600px\)/,
        );
        expect(start).toBeGreaterThan(-1);
        const rest = CSS.slice(start);
        const block = rest.slice(0, rest.indexOf("@media", 1));
        expect(block).toMatch(/\.nav-hamburger\s*\{[^}]*display:\s*inline-flex/);
        expect(block).toMatch(/\.nav-links\.is-open\s*\{[^}]*display:\s*flex/);
    });
});
