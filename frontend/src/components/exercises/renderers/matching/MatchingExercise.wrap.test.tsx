/**
 * #3174 - a single over-long word inside a matching tile must wrap (CSS
 * hyphenation + an overflow-wrap fallback) instead of running past the
 * tile edge, and the tile columns must carry the CONTENT language so
 * ``hyphens: auto`` breaks at the right dictionary points: ``<html lang>``
 * follows the UI language, which is the wrong one for a German set played
 * in an English UI.
 *
 * Pins: the wrap classes on every tile label (both columns) and on the
 * post-check feedback lines that repeat the same word; the per-column
 * ``lang`` (left = target, right = source in a receptive drill, flipped in
 * a productive one); no ``lang`` at all when the set carries no pair, so
 * the tile inherits the document language instead of a stale value.
 */

import "@testing-library/jest-dom/vitest";
import {fireEvent, render, screen, within} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";

import MatchingExercise, {type MatchingExerciseProps} from "./MatchingExercise";
import type {ContentLessonExercise} from "../../../../storage/types";

/** 30 characters without a break point the browser finds on its own - the
 *  exact shape of the iPhone report ("bedeutungsunterscheidende"). */
const LONG_WORD = "Grundstücksverkehrsgenehmigung";
const WRAP_CLASSES = ["hyphens-auto", "[overflow-wrap:anywhere]"];

const EXERCISE: ContentLessonExercise = {
    id: "ex-match-long-word",
    type: "matching",
    prompt: "Ordne die Begriffe zu.",
    card_ids: [],
    direction: "target_to_source",
    pairs: [
        {left: LONG_WORD, right: "building permit"},
        {left: "Haus", right: "house"},
    ],
    distractors: [],
};

function renderMatching(props: Partial<MatchingExerciseProps> = {}) {
    return render(
        <MatchingExercise
            exercise={EXERCISE}
            onComplete={vi.fn()}
            targetLanguage="de"
            sourceLanguage="en"
            {...props}
        />,
    );
}

describe("MatchingExercise #3174: long words wrap inside the tile", () => {
    it("the fixture word is 30 characters long", () => {
        expect(LONG_WORD).toHaveLength(30);
    });

    it("a left tile label carries hyphenation + the overflow-wrap fallback", () => {
        renderMatching();
        const label = within(screen.getByTestId("matching-left-0")).getByText(
            LONG_WORD,
        );
        expect(label).toHaveClass(...WRAP_CLASSES);
    });

    it("a right tile label carries the same wrap classes", () => {
        renderMatching();
        const label = within(screen.getByTestId("matching-right-0")).getByText(
            "building permit",
        );
        expect(label).toHaveClass(...WRAP_CLASSES);
    });

    it("the post-check feedback lines wrap the repeated word too", () => {
        renderMatching();
        fireEvent.click(screen.getByTestId("matching-left-0"));
        fireEvent.click(screen.getByTestId("matching-right-1"));
        fireEvent.click(screen.getByTestId("matching-left-1"));
        fireEvent.click(screen.getByTestId("matching-right-0"));
        fireEvent.click(screen.getByTestId("matching-submit"));
        // #3186 / #3233 - the feedback rows live in the Corrections view.
        fireEvent.click(screen.getByTestId("matching-corrections"));
        expect(screen.getByTestId("matching-your-answer-0")).toHaveClass(
            ...WRAP_CLASSES,
        );
        expect(screen.getByTestId("matching-correct-hint-0")).toHaveClass(
            ...WRAP_CLASSES,
        );
    });
});

describe("MatchingExercise #3174: tile columns carry the content language", () => {
    it("receptive drill: left column = target language, right = source", () => {
        renderMatching();
        expect(screen.getByTestId("matching-left")).toHaveAttribute("lang", "de");
        expect(screen.getByTestId("matching-right")).toHaveAttribute(
            "lang",
            "en",
        );
    });

    it("productive drill flips the column languages with the columns", () => {
        renderMatching({
            exercise: {...EXERCISE, direction: "source_to_target"},
        });
        expect(screen.getByTestId("matching-left")).toHaveAttribute("lang", "en");
        expect(screen.getByTestId("matching-right")).toHaveAttribute(
            "lang",
            "de",
        );
    });

    it("without a language pair the columns carry no lang attribute", () => {
        renderMatching({targetLanguage: null, sourceLanguage: null});
        expect(screen.getByTestId("matching-left")).not.toHaveAttribute("lang");
        expect(screen.getByTestId("matching-right")).not.toHaveAttribute(
            "lang",
        );
    });

    it("a knowledge set (source == target) tags both columns with that language", () => {
        renderMatching({targetLanguage: "de", sourceLanguage: "de", domain: "psychology"});
        expect(screen.getByTestId("matching-left")).toHaveAttribute("lang", "de");
        expect(screen.getByTestId("matching-right")).toHaveAttribute(
            "lang",
            "de",
        );
    });
});
