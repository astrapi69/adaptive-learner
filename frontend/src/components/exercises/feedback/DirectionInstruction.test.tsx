/**
 * Tests for the domain-aware DirectionInstruction (#1226 / EXP-041).
 *
 * Pins that a word_tiles exercise for a knowledge / same-language lesson
 * shows a sentence-building instruction instead of the translation-framed
 * wording — mirroring the MatchingExercise #149 rule through the shared
 * ``isKnowledgeDomain`` decision. In the vitest environment the i18n
 * catalog is not loaded, so ``t()`` returns the English fallbacks; the
 * catalog content itself is asserted against the generated de.json.
 */

import "@testing-library/jest-dom/vitest";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {render, screen} from "@testing-library/react";
import {describe, expect, it} from "vitest";

import DirectionInstruction from "./DirectionInstruction";
import {isKnowledgeDomain} from "../../../lib/exercises/knowledge-domain";
import {computeMatchingLabels} from "../renderers/matching-parts";
import type {ContentLessonExercise} from "../../../storage/types";

const WORD_TILES: ContentLessonExercise = {
    id: "ex-wt",
    type: "word_tiles",
    prompt: "Definition: Ankereffekt",
    card_ids: [],
    distractors: [],
    direction: "target_to_source", // receptive — the buggy "translation" path
    tiles: ["Der", "Ankereffekt", "ist", "eine", "Verzerrung."],
};

const tid = "direction-instruction-word_tiles";

describe("DirectionInstruction: word_tiles domain-aware wording (#1226)", () => {
    it("source==target shows a sentence-building instruction, NOT a translation one", () => {
        render(
            <DirectionInstruction
                exercise={WORD_TILES}
                domain="psychology"
                sourceLanguage="de"
                targetLanguage="de"
            />,
        );
        const text = screen.getByTestId(tid).textContent ?? "";
        expect(text).toMatch(/Build the sentence/i);
        expect(text).not.toMatch(/translation/i);
    });

    it("treats source==target as knowledge even without an explicit domain", () => {
        render(
            <DirectionInstruction
                exercise={WORD_TILES}
                sourceLanguage="de"
                targetLanguage="de"
            />,
        );
        const text = screen.getByTestId(tid).textContent ?? "";
        expect(text).toMatch(/Build the sentence/i);
        expect(text).not.toMatch(/translation/i);
    });

    it("keeps the translation instruction for a real language pair (regression guard)", () => {
        render(
            <DirectionInstruction
                exercise={WORD_TILES}
                domain="language"
                sourceLanguage="de"
                targetLanguage="es"
            />,
        );
        // Receptive language-learning drill still frames it as translation.
        expect(screen.getByTestId(tid).textContent ?? "").toMatch(
            /Build the translation/i,
        );
    });

    it("uses knowledge wording for a non-language domain too", () => {
        render(
            <DirectionInstruction
                exercise={WORD_TILES}
                domain="programming"
            />,
        );
        const text = screen.getByTestId(tid).textContent ?? "";
        expect(text).toMatch(/Build the sentence/i);
        expect(text).not.toMatch(/translation/i);
    });
});

describe("DirectionInstruction: consistency with matching #149", () => {
    const t = (_key: string, fallback?: string) => fallback ?? _key;

    it("isKnowledgeDomain makes the same decision DirectionInstruction and matching use", () => {
        // The exact cases MatchingExercise's #149 tests pin.
        expect(isKnowledgeDomain("psychology", "de", "de")).toBe(true);
        expect(isKnowledgeDomain(null, "de", "de")).toBe(true);
        expect(isKnowledgeDomain("programming", null, null)).toBe(true);
        expect(isKnowledgeDomain("language", "de", "es")).toBe(false);
        expect(isKnowledgeDomain(null, "de", "es")).toBe(false);
    });

    it("matching resolves the same isKnowledge as isKnowledgeDomain", () => {
        const matchingEx: ContentLessonExercise = {
            id: "ex-m",
            type: "matching",
            prompt: "Match.",
            card_ids: [],
            distractors: [],
            pairs: [{left: "a", right: "b"}],
        };
        for (const [domain, src, tgt] of [
            ["psychology", "de", "de"],
            ["language", "de", "es"],
            [null, "de", "de"],
        ] as const) {
            const labels = computeMatchingLabels(matchingEx, {
                uiLang: "en",
                targetLanguage: tgt,
                sourceLanguage: src,
                domain,
                t,
            });
            expect(labels.isKnowledge).toBe(
                isKnowledgeDomain(domain, src, tgt),
            );
        }
    });
});

describe("DirectionInstruction: knowledge instruction comes from the i18n catalog", () => {
    it("de.json defines lesson.exercise.instruction.word_tiles.knowledge with real German wording", () => {
        const raw = readFileSync(
            join(__dirname, "../../../data/i18n/de.json"),
            "utf-8",
        );
        const catalog = JSON.parse(raw) as Record<string, unknown>;
        const value = (
            (
                (
                    (catalog.lesson as Record<string, unknown>)
                        .exercise as Record<string, unknown>
                ).instruction as Record<string, unknown>
            ).word_tiles as Record<string, string>
        ).knowledge;
        expect(value).toBe("Bilde den Satz");
        // Non-translation framing in the German catalog too.
        expect(value).not.toMatch(/Übersetz/i);
    });
});
