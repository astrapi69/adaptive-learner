/**
 * Regression pin: the dead per-theme token trio removed with the
 * matching-twin cleanup (#2451) stays gone.
 *
 * ``--exercise-matched`` + ``--matching-paired-bg`` + ``--matching-paired-fg``
 * were defined in all 12 ``theme-*.css`` files but had ZERO consumers
 * anywhere in the repo (no ``var()``, no JS resolved read, no test) - the
 * only non-definition use was ``--matching-paired-bg`` feeding off
 * ``--exercise-matched``, and that surface is never rendered. They are the
 * dead half of a one-letter name twin: the LIVE matching palette is
 * ``--matching-pair-N`` (global.css, #181) + ``--matching-correct/error-*``
 * (global.css, #183), consumed via ``matchingPairColorVar``. The dead
 * ``--matching-paired-*`` is the superseded predecessor.
 *
 * This is a fingerprint pin, not a visual one: it proves the NAMES are
 * absent from the token layer. The user-visible proof that removal changed
 * no pixel is the 12-theme visual-regression baseline (which renders the
 * APP, not the token) - that runs in CI, and its zero-diff follows by
 * construction from the zero-consumer count these tokens carried.
 *
 * If a future feature genuinely needs one of these names: delete the entry
 * here in the same change AND wire a real consumer, so the name cannot
 * reappear as a definition that nothing reads (the exact state removed).
 */

import {describe, expect, it} from "vitest";

import {THEME_IDS} from "../lib/theme/themes";
import {readLegacyCssSum} from "./legacy-css-sum";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Token names that must never be redefined (dead, 0 consumers). */
const REMOVED_TOKENS = [
    "exercise-matched",
    "matching-paired-bg",
    "matching-paired-fg",
];

describe("#2451 — dead matching-twin tokens stay removed", () => {
    for (const id of THEME_IDS) {
        it(`theme=${id} defines none of the removed tokens`, () => {
            const css = readFileSync(
                resolve(HERE, `themes/theme-${id}.css`),
                "utf-8",
            );
            for (const tok of REMOVED_TOKENS) {
                expect(
                    css.includes(`--${tok}:`),
                    `theme ${id} re-defines --${tok}`,
                ).toBe(false);
            }
        });
    }

    it("no legacy/global CSS redefines the removed tokens", () => {
        const css = readLegacyCssSum();
        for (const tok of REMOVED_TOKENS) {
            expect(css.includes(`--${tok}:`), `--${tok} redefined`).toBe(false);
        }
    });
});
