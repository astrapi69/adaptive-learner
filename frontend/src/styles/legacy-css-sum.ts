/**
 * Test-time reader for the app's legacy stylesheet as ONE string:
 * ``global.css`` plus every concern file the #1655 split peels out of it
 * (``styles/legacy/*.css``, filename-sorted, matching the ``@import``
 * order in ``global.css``).
 *
 * Style pins and guards that assert on rules or tokens from the monolith
 * MUST read this sum, never ``global.css`` alone: a peel moves lines
 * verbatim into ``styles/legacy/``, and a direct reader silently loses
 * them. That is exactly how the ``--matching-pair-*`` hue pin in
 * ``MatchingExercise.test.tsx`` went red on develop after Peel 1 (#1665)
 * while the selective PR gate missed it (``readFileSync`` reads are
 * invisible to ``vitest --changed``'s module graph, the #1620 class).
 *
 * Resolves from ``process.cwd()`` because vitest always runs from
 * ``frontend/`` (see lessons-learned) and ``import.meta.url`` is an http
 * URL under happy-dom - so the helper works in the ``node`` AND
 * ``happy-dom`` test environments alike.
 *
 * @example
 * const css = readLegacyCssSum();
 * expect(css).toMatch(/--matching-pair-1:/);
 */
import {readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";

export function readLegacyCssSum(): string {
    const stylesDir = join(process.cwd(), "src", "styles");
    const parts = [readFileSync(join(stylesDir, "global.css"), "utf-8")];
    const legacyDir = join(stylesDir, "legacy");
    let entries: string[] = [];
    try {
        entries = readdirSync(legacyDir).sort();
    } catch {
        /* styles/legacy does not exist before the first peel */
    }
    for (const entry of entries) {
        if (entry.endsWith(".css")) {
            parts.push(readFileSync(join(legacyDir, entry), "utf-8"));
        }
    }
    return parts.join("\n");
}
