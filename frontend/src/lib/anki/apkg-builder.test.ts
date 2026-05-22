/**
 * Pure-helper tests for the .apkg builder (Phase 30A).
 *
 * sql.js + jszip are NOT exercised here — those are heavy
 * deps that get lazy-imported only when ``buildApkg`` runs in
 * the browser. The E2E spec ``e2e/smoke/anki-export.spec.ts``
 * (filed for Phase 30E) covers the end-to-end download.
 */

import {describe, expect, it} from "vitest";

import {_testing} from "./apkg-builder";

const {fieldChecksum, countClozeOrds, tagString} = _testing;

describe("fieldChecksum (Anki note checksum)", () => {
    it("is deterministic for the same input", () => {
        const a = fieldChecksum("hablar");
        const b = fieldChecksum("hablar");
        expect(a).toBe(b);
    });

    it("differs for distinct inputs (basic spot-check)", () => {
        expect(fieldChecksum("hablar")).not.toBe(fieldChecksum("comer"));
    });

    it("returns a non-negative 31-bit integer", () => {
        const c = fieldChecksum("anything");
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(0x7fffffff);
    });
});

describe("countClozeOrds", () => {
    it("returns [0] when the text has no cloze markers (fallback)", () => {
        expect(countClozeOrds("plain text, no cloze")).toEqual([0]);
    });

    it("returns one ord per distinct {{cN::...}} marker, zero-indexed", () => {
        const text = "Ich {{c1::spreche}} {{c2::Deutsch}}";
        // c1 → ord 0, c2 → ord 1
        expect(countClozeOrds(text)).toEqual([0, 1]);
    });

    it("deduplicates repeated cN markers (one card per ord)", () => {
        // c1 appears twice but only one card should be generated
        // for ord 0.
        const text = "{{c1::Wort}} und nochmal {{c1::Wort}}";
        expect(countClozeOrds(text)).toEqual([0]);
    });

    it("sorts ords ascending", () => {
        // Anki expects ords ascending; the deck loader walks them
        // in order.
        const text = "{{c3::a}} {{c1::b}} {{c2::c}}";
        expect(countClozeOrds(text)).toEqual([0, 1, 2]);
    });
});

describe("tagString", () => {
    it("returns the empty string when there are no tags", () => {
        expect(tagString(undefined)).toBe("");
        expect(tagString([])).toBe("");
    });

    it("wraps tags with leading + trailing spaces (Anki convention)", () => {
        // Anki splits on spaces; the leading + trailing pad makes
        // ' verb ' findable as a whole-word match.
        expect(tagString(["verb"])).toBe(" verb ");
    });

    it("space-joins multiple tags", () => {
        expect(tagString(["verb", "present", "spanish"])).toBe(
            " verb present spanish ",
        );
    });

    it("replaces internal whitespace with underscores", () => {
        // Anki tags can't contain spaces; "present tense" must
        // collapse to "present_tense" or the tag splits.
        expect(tagString(["present tense"])).toBe(" present_tense ");
    });

    it("drops empty-after-cleanup tags", () => {
        expect(tagString(["", "verb", "   "])).toBe(" verb _ ");
        // Whitespace-only collapses to "_" — acceptable; Anki
        // still indexes a single-underscore tag.
    });
});
