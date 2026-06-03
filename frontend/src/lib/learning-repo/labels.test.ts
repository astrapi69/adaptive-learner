/**
 * Pure tests for labels.ts (Phase 49C / v1.32.0 /
 * PHASE-42-STORAGE-ABSTRACTION-01).
 *
 * Mirrors the contract of the Python ``labels_for(language)``:
 * load i18n catalog, overlay ``repo.*`` keys onto English
 * defaults, fall back silently on missing / malformed input.
 *
 * The bundled JSON catalogs are loaded via
 * ``import.meta.glob`` at module load time, so these tests
 * exercise the production code path 1:1.
 */

import {describe, expect, it} from "vitest";

import {DEFAULT_LABELS, formatLabel, labelsFor} from "./labels";

describe("DEFAULT_LABELS", () => {
    it("matches the Python dataclass defaults for key fields", () => {
        // Pin a handful of the load-bearing defaults — full
        // dataclass parity is enforced by the cross-renderer
        // parity test in 49F.
        expect(DEFAULT_LABELS.readme_title).toBe(
            "Learning Project: {topic}",
        );
        expect(DEFAULT_LABELS.readme_active).toBe("active");
        expect(DEFAULT_LABELS.readme_archived).toBe("archived");
        expect(DEFAULT_LABELS.stats_no_sessions).toBe(
            "_No sessions yet._",
        );
        expect(DEFAULT_LABELS.stats_exit_pin_marker).toBe(
            "✅ exit threshold met",
        );
    });
});

describe("labelsFor", () => {
    it("returns the EN bundle that matches the default labels", async () => {
        const labels = await labelsFor("en");
        // The en.yaml catalog ships every repo.* key, so
        // every default should be present. We assert on a
        // few load-bearing fields rather than diffing the
        // whole map.
        expect(labels.readme_title).toBe("Learning Project: {topic}");
        expect(labels.stats_title).toBe("Learning Statistics");
        expect(labels.roadmap_title).toBe("Roadmap");
    });

    it("falls back to EN bundle for an unknown language", async () => {
        const labels = await labelsFor("xx");
        expect(labels.readme_title).toBe("Learning Project: {topic}");
    });

    it("returns a separate object reference on each call (no shared mutation risk)", async () => {
        const a = await labelsFor("en");
        const b = await labelsFor("en");
        expect(a).not.toBe(b);
        expect(a).toEqual(b);
    });

    it("loads the DE bundle and surfaces the translated strings", async () => {
        const labels = await labelsFor("de");
        // Both EN and DE should have a non-empty title; only
        // assert here that the key is present + a string,
        // not on the German text itself (which is owned by
        // the i18n catalog, not this test).
        expect(typeof labels.readme_title).toBe("string");
        expect(labels.readme_title.length).toBeGreaterThan(0);
    });
});

describe("formatLabel", () => {
    it("substitutes named placeholders", () => {
        expect(
            formatLabel("Learning Project: {topic}", {topic: "Spanish"}),
        ).toBe("Learning Project: Spanish");
    });

    it("substitutes numeric values via String()", () => {
        expect(
            formatLabel("step {step}/7", {step: 4}),
        ).toBe("step 4/7");
    });

    it("supports multiple placeholders", () => {
        expect(
            formatLabel("{a} and {b}", {a: "foo", b: "bar"}),
        ).toBe("foo and bar");
    });

    it("leaves unknown placeholders untouched", () => {
        expect(
            formatLabel("known {a} unknown {b}", {a: "X"}),
        ).toBe("known X unknown {b}");
    });

    it("returns the template unchanged when no placeholders match", () => {
        expect(formatLabel("plain text", {a: "X"})).toBe("plain text");
    });
});
