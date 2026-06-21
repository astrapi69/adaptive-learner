/**
 * Tests for resolveTreePlacement (EXP-026 / UGC-01, #97).
 */

import {describe, expect, it} from "vitest";

import type {ContentSetEntry} from "../../../storage/types";
import {resolveTreePlacement, type UserSetPlacementInput} from "./tree-placement";

function publishedSet(over: Partial<ContentSetEntry>): ContentSetEntry {
    return {
        source: "bundled:adaptive-learner-content",
        branch: "main",
        id: "set-id",
        title: "A set",
        title_native: null,
        language: "es",
        target_language: "es",
        source_language: "de",
        level: "A1",
        domain: "language",
        version: "1.0.0",
        lesson_count: 5,
        description: null,
        tags: [],
        cover_image: null,
        cached_version: "1.0.0",
        update_available: false,
        ...over,
    };
}

function userSet(over: Partial<UserSetPlacementInput>): UserSetPlacementInput {
    return {
        source_language: "de",
        target_language: "es",
        level: "A1",
        domain: "language",
        title: "Mein Spanisch",
        ...over,
    };
}

describe("resolveTreePlacement", () => {
    it("matches a language set on base pair + normalized level", () => {
        const target = publishedSet({id: "es-a1-from-de"});
        const result = resolveTreePlacement(
            userSet({source_language: "de-AT", target_language: "ES", level: " a1 "}),
            [publishedSet({id: "other", target_language: "fr"}), target],
        );
        expect(result).toEqual({matched: true, set: target});
    });

    it("returns a no-match fallback when no published node fits", () => {
        const result = resolveTreePlacement(
            userSet({level: "B2"}),
            [publishedSet({level: "A1"})],
        );
        expect(result).toEqual({matched: false, reason: "no_matching_node"});
    });

    it("falls back to ambiguous when several candidates match and no variation_of", () => {
        const result = resolveTreePlacement(userSet({}), [
            publishedSet({id: "es-a1-official"}),
            publishedSet({id: "es-a1-community"}),
        ]);
        expect(result).toEqual({matched: false, reason: "ambiguous"});
    });

    it("breaks ambiguity with variation_of pointing at one candidate", () => {
        const community = publishedSet({id: "es-a1-community"});
        const result = resolveTreePlacement(
            userSet({variationOf: "es-a1-community-lesson-2"}),
            [publishedSet({id: "es-a1-official"}), community],
        );
        expect(result).toEqual({matched: true, set: community});
    });

    it("stays ambiguous when variation_of matches none of the candidates", () => {
        const result = resolveTreePlacement(
            userSet({variationOf: "unrelated-set-lesson-1"}),
            [publishedSet({id: "es-a1-official"}), publishedSet({id: "es-a1-community"})],
        );
        expect(result).toEqual({matched: false, reason: "ambiguous"});
    });

    it("matches a knowledge set on domain + exact title", () => {
        const target = publishedSet({
            id: "psych-101",
            domain: "psychology",
            title: "Einführung in die Psychologie",
            source_language: "de",
            target_language: "de",
        });
        const result = resolveTreePlacement(
            userSet({
                domain: "psychology",
                title: "  Einführung in die Psychologie ",
                source_language: "de",
                target_language: "de",
            }),
            [publishedSet({domain: "programming", title: "Python"}), target],
        );
        expect(result).toEqual({matched: true, set: target});
    });

    it("does not place a knowledge set when the title differs", () => {
        const result = resolveTreePlacement(
            userSet({domain: "psychology", title: "My own psychology notes"}),
            [publishedSet({domain: "psychology", title: "Official psychology"})],
        );
        expect(result).toEqual({matched: false, reason: "no_matching_node"});
    });

    it("falls back on incomplete metadata", () => {
        expect(
            resolveTreePlacement(userSet({level: ""}), [publishedSet({})]),
        ).toEqual({matched: false, reason: "incomplete_metadata"});
        expect(
            resolveTreePlacement(userSet({target_language: ""}), [publishedSet({})]),
        ).toEqual({matched: false, reason: "incomplete_metadata"});
    });

    it("falls back when a language set teaches its own language", () => {
        const result = resolveTreePlacement(
            userSet({source_language: "de", target_language: "de"}),
            [publishedSet({})],
        );
        expect(result).toEqual({matched: false, reason: "same_language"});
    });
});
