/**
 * The delivered SEO text carries no counts (#2403).
 *
 * Four different set counts circulated in publicly delivered text at
 * once (26 in the meta description and JSON-LD, 26/424 in the help,
 * 28 in the README stats, 45 live) - and the meta description is the
 * line a search result shows. Decision recorded in EXP-049: counts
 * leave text that no gate holds; index.html is in-repo, so this pin
 * IS the gate. If a count is ever wanted back, derive it at build
 * time (the README CONTENT-STATS mechanic), never hand-write it.
 *
 * readFileSync-based, so the selective PR run may skip it on
 * unrelated changes (#1620) - the full/nightly run is the net.
 */

import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

import {describe, expect, it} from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(join(here, "..", "..", "index.html"), "utf-8");

const COUNT_CLAIM =
    /\b\d+\s+(?:content[- ]sets?|Content-Sets?|Lernmodi|learning modes|Sprachen|languages|Lektionen|lessons|Karten|cards|Domänen|domains)\b/gi;

describe("index.html delivered text (#2403)", () => {
    it("carries no hand-written content counts", () => {
        const hits = indexHtml.match(COUNT_CLAIM) ?? [];
        expect(hits, `stale count claims in index.html: ${hits.join(", ")}`).toEqual([]);
    });
});
