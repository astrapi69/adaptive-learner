/**
 * Difficulty indicator (#1693 / Option B of #1599): the ``resolveDifficulty``
 * deriver + the dispatcher wiring that renders the badge ABOVE every
 * renderable exercise. The pre-#1693 corpus (cards without authored
 * ``difficulty``) stays untouched — the badge renders nothing.
 */

import "@testing-library/jest-dom/vitest";
import {describe, expect, it, vi} from "vitest";
import {render, screen} from "@testing-library/react";

const useAssetMock = vi.fn(() => ({
    url: null,
    loading: false,
    error: false,
}));
vi.mock("../../../hooks/ui/useAsset", () => ({
    useAsset: () => useAssetMock(),
}));

import {ExerciseDispatcher, resolveDifficulty} from "./ExerciseDispatcher";
import {I18nProvider} from "../../../hooks/ui/useI18n";
import type {
    ContentLessonCard,
    ContentLessonExercise,
    ContentLessonStep,
} from "../../../storage/types";

function card(
    id: string,
    difficulty: number | null,
): ContentLessonCard {
    return {
        id,
        front: id,
        back: id,
        notes: null,
        image: null,
        audio: null,
        difficulty,
        tags: [],
        token_roles: null,
    } as unknown as ContentLessonCard;
}

function exercise(card_ids: string[]): ContentLessonExercise {
    return {
        id: "ex1",
        type: "matching",
        prompt: "Match",
        card_ids,
        distractors: [],
    } as unknown as ContentLessonExercise;
}

describe("resolveDifficulty (#1693)", () => {
    it("reproduction: an exercise whose cards carry difficulty yields a level", () => {
        // Pre-#1693 there was no per-exercise difficulty accessor at all.
        expect(resolveDifficulty(exercise(["c1"]), [card("c1", 4)])).toBe(4);
    });

    it("happy path: averages the referenced cards, rounded", () => {
        const cards = [card("c1", 2), card("c2", 5)];
        // (2 + 5) / 2 = 3.5 -> round -> 4
        expect(resolveDifficulty(exercise(["c1", "c2"]), cards)).toBe(4);
    });

    it("edge: cards without a valid difficulty are ignored", () => {
        const cards = [card("c1", null), card("c2", 3)];
        expect(resolveDifficulty(exercise(["c1", "c2"]), cards)).toBe(3);
    });

    it("edge: no referenced card carries a difficulty -> null", () => {
        expect(resolveDifficulty(exercise(["c1"]), [card("c1", null)])).toBeNull();
    });

    it("edge: unreferenced cards do not leak in", () => {
        // c2 is not referenced by the exercise; only c1 (unset) counts.
        const cards = [card("c1", null), card("c2", 5)];
        expect(resolveDifficulty(exercise(["c1"]), cards)).toBeNull();
    });

    it("edge: empty / missing card_ids -> null", () => {
        expect(resolveDifficulty(exercise([]), [card("c1", 3)])).toBeNull();
    });

    it("boundary: out-of-range difficulties (0 and 9) contribute nothing", () => {
        const cards = [card("c1", 0), card("c2", 9)];
        expect(resolveDifficulty(exercise(["c1", "c2"]), cards)).toBeNull();
    });

    it("boundary: the 1 and 5 endpoints are accepted", () => {
        expect(resolveDifficulty(exercise(["c1"]), [card("c1", 1)])).toBe(1);
        expect(resolveDifficulty(exercise(["c1"]), [card("c1", 5)])).toBe(5);
    });
});

function step(
    type: string,
    card_ids: string[],
    extra: Record<string, unknown> = {},
): ContentLessonStep {
    return {
        id: "s1",
        type: "exercise",
        exercise: {
            id: "ex1",
            type,
            prompt: "Prompt",
            card_ids,
            distractors: [],
            ...extra,
        },
    } as unknown as ContentLessonStep;
}

function renderDispatcher(s: ContentLessonStep, cards: ContentLessonCard[]) {
    return render(
        <I18nProvider>
            <ExerciseDispatcher
                step={s}
                setId="set-1"
                lessonId="lesson-1"
                source="owner/repo"
                cards={cards}
                onComplete={vi.fn()}
            />
        </I18nProvider>,
    );
}

describe("ExerciseDispatcher difficulty-badge wiring (#1693)", () => {
    it("renders the badge when a referenced card carries difficulty", () => {
        renderDispatcher(
            step("multiple_choice", ["c1"], {
                options: [{text: "a", correct: true}, {text: "b"}],
            }),
            [card("c1", 3)],
        );
        const badge = screen.getByTestId("difficulty-badge");
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveAttribute("data-difficulty", "3");
    });

    it("renders nothing when no referenced card carries difficulty", () => {
        renderDispatcher(
            step("multiple_choice", ["c1"], {
                options: [{text: "a", correct: true}, {text: "b"}],
            }),
            [card("c1", null)],
        );
        expect(screen.queryByTestId("difficulty-badge")).toBeNull();
    });

    it("shows the badge on a matching exercise too (all types wrapped)", () => {
        renderDispatcher(
            step("matching", ["c1"], {
                pairs: [
                    {left: "a", right: "1"},
                    {left: "b", right: "2"},
                ],
            }),
            [card("c1", 5)],
        );
        expect(screen.getByTestId("difficulty-badge")).toHaveAttribute(
            "data-difficulty",
            "5",
        );
    });

    it("does not render a badge on an unsupported exercise type", () => {
        renderDispatcher(step("no_such_type", ["c1"]), [card("c1", 4)]);
        expect(screen.queryByTestId("difficulty-badge")).toBeNull();
    });
});
