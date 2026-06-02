/**
 * QA B3 — prefers-reduced-motion regression pin for the lesson
 * read-aloud animations (TTS C1 pulse + C5 follow-along highlight).
 *
 * The feature spec required "no highlight animation under reduced
 * motion". A universal catch-all block neutralises durations, but the
 * feature also ships explicit, intentional per-rule handling — the
 * speaking-button pulse turns off and the active-word wash becomes a
 * static underline. happy-dom runs no layout, so we pin the CSS source
 * directly (same approach as reduced-motion.test.ts /
 * content-set-action.test.ts).
 */

import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";
import {describe, expect, it} from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(resolve(HERE, "global.css"), "utf-8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
);

/** Concatenate the bodies of every
 *  ``@media (prefers-reduced-motion: reduce) { ... }`` block via brace
 *  counting (the blocks contain nested rules, so a [^}] slice won't
 *  do). Returns reduced-motion-only CSS so assertions can't be
 *  satisfied by a rule that lives outside the media query. */
function reducedMotionCss(css: string): string {
    const opener = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g;
    const bodies: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = opener.exec(css)) !== null) {
        let depth = 1;
        let i = m.index + m[0].length;
        const start = i;
        for (; i < css.length && depth > 0; i++) {
            if (css[i] === "{") depth++;
            else if (css[i] === "}") depth--;
        }
        bodies.push(css.slice(start, i - 1));
    }
    return bodies.join("\n");
}

const RM = reducedMotionCss(CSS);

describe("read-aloud reduced-motion handling (B3)", () => {
    it("defines the speaking-button pulse animation (so there is something to disable)", () => {
        expect(CSS).toMatch(/@keyframes\s+read-aloud-pulse\s*\{/);
        expect(CSS).toMatch(
            /\.read-aloud-button\.is-speaking\s*\{[^}]*animation:\s*read-aloud-pulse/,
        );
    });

    it("disables the speaking-button pulse under reduced motion", () => {
        expect(RM).toMatch(
            /\.read-aloud-button\.is-speaking\s*\{[^}]*animation:\s*none/,
        );
    });

    it("drops the follow-along wash for a static underline under reduced motion", () => {
        const active = RM.match(
            /\.lesson-read-along-word\.tts-active\s*\{([^}]*)\}/,
        );
        expect(active, "tts-active reduced-motion rule present").not.toBeNull();
        expect(active![1]).toMatch(/background:\s*transparent/);
        expect(active![1]).toMatch(/text-decoration:\s*underline/);
    });

    it("removes the active-word transition under reduced motion", () => {
        expect(RM).toMatch(
            /\.lesson-read-along-word\s*\{[^}]*transition:\s*none/,
        );
    });
});
