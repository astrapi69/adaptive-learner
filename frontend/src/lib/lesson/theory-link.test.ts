import {describe, it, expect} from "vitest";

import type {
    ContentLessonCard,
    ContentLessonExercise,
    ContentLessonStep,
} from "../../storage/types";
import {
    findPrecedingTheoryIndex,
    findRelatedTheoryIndex,
} from "./theory-link";

function step(
    id: string,
    type: "theory" | "exercise",
): ContentLessonStep {
    return {id, type} as ContentLessonStep;
}

function theory(id: string, title: string, body: string): ContentLessonStep {
    return {id, type: "theory", title, body};
}

function exerciseStep(
    id: string,
    prompt: string,
    cardIds: string[],
): ContentLessonStep {
    return {
        id,
        type: "exercise",
        exercise: {
            id: `${id}-ex`,
            type: "matching",
            prompt,
            card_ids: cardIds,
            distractors: [],
        } as ContentLessonExercise,
    };
}

function card(
    id: string,
    front: string,
    back: string,
): ContentLessonCard {
    return {id, front, back, tags: []};
}

const STEPS: ContentLessonStep[] = [
    step("t0", "theory"),
    step("e1", "exercise"),
    step("e2", "exercise"),
    step("t3", "theory"),
    step("e4", "exercise"),
];

describe("findPrecedingTheoryIndex", () => {
    it("returns the nearest theory step before an exercise", () => {
        expect(findPrecedingTheoryIndex(STEPS, 1)).toBe(0);
        expect(findPrecedingTheoryIndex(STEPS, 2)).toBe(0);
        expect(findPrecedingTheoryIndex(STEPS, 4)).toBe(3);
    });

    it("returns null when the current step is itself theory", () => {
        expect(findPrecedingTheoryIndex(STEPS, 0)).toBeNull();
        expect(findPrecedingTheoryIndex(STEPS, 3)).toBeNull();
    });

    it("returns null when no theory step precedes the exercise", () => {
        const noLeadingTheory = [step("e0", "exercise"), step("e1", "exercise")];
        expect(findPrecedingTheoryIndex(noLeadingTheory, 1)).toBeNull();
    });

    it("returns null for an out-of-range index", () => {
        expect(findPrecedingTheoryIndex(STEPS, 99)).toBeNull();
        expect(findPrecedingTheoryIndex(STEPS, -1)).toBeNull();
    });
});

// --- #634: thematic back-link resolution -----------------------------------

describe("findRelatedTheoryIndex", () => {
    // "Lernen und Konditionierung": Pawlow theory (0,1), an unrelated
    // Bandura theory (2), then the Pawlow exercise (3). The back-link must
    // resolve to the Pawlow theory, NOT the nearest (Bandura) one.
    const STEPS_TOPICAL: ContentLessonStep[] = [
        theory(
            "t0",
            "Klassische Konditionierung",
            "Iwan Pawlow zeigte mit Hunden den unkonditionierten Reiz.",
        ),
        theory(
            "t1",
            "Pawlows Begriffe",
            "Neutraler Reiz, konditionierte Reaktion und Reizgeneralisierung.",
        ),
        theory(
            "t2",
            "Modelllernen",
            "Albert Bandura beschrieb das Lernen am Modell (Bobo-Doll).",
        ),
        exerciseStep("e3", "Pawlows Begriffe zuordnen", ["c-nr", "c-kr"]),
    ];
    const CARDS_TOPICAL: ContentLessonCard[] = [
        card("c-nr", "Neutraler Reiz", "neutral stimulus"),
        card("c-kr", "Konditionierte Reaktion", "conditioned response"),
    ];

    it("resolves to the thematically matching theory, not the nearest one", () => {
        // Nearest preceding is t2 (Bandura, index 2); the related one is
        // the Pawlow block (index 1, tie-broken to the nearest match).
        expect(
            findRelatedTheoryIndex(STEPS_TOPICAL, CARDS_TOPICAL, 3),
        ).toBe(1);
    });

    it("falls back to the nearest preceding theory when no term overlaps", () => {
        // Generic prompt + cards with no overlap → keep the existing
        // nearest-preceding behaviour (index 2).
        const generic = [
            ...STEPS_TOPICAL.slice(0, 3),
            exerciseStep("e3", "Ordne zu", ["c-x"]),
        ];
        const cards = [card("c-x", "alpha", "beta")];
        expect(findRelatedTheoryIndex(generic, cards, 3)).toBe(2);
    });

    it("returns null when the step is theory or out of range", () => {
        expect(findRelatedTheoryIndex(STEPS_TOPICAL, CARDS_TOPICAL, 0)).toBeNull();
        expect(
            findRelatedTheoryIndex(STEPS_TOPICAL, CARDS_TOPICAL, 99),
        ).toBeNull();
    });

    it("returns null when no theory precedes the exercise", () => {
        const noTheory = [exerciseStep("e0", "Pawlow", ["c"])];
        expect(findRelatedTheoryIndex(noTheory, [], 0)).toBeNull();
    });
});
