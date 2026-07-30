/**
 * RED-first tests for computeUpdateImpact (#2128 update-identity guard).
 *
 * The guard's heart: given the identities a learner's progress/SRS rows pin
 * to, and the identities an INCOMING set version actually contains, decide
 * whether applying that update would orphan any progress-bearing identity —
 * BEFORE it is applied. Mirrors the three orphaning mechanisms proven by the
 * characterization test (#2129): positional exercise_id shift, element_key
 * (answer) change, lesson-file rename.
 */

import {describe, expect, it} from "vitest";

import {
    buildIncomingIdentities,
    computeUpdateImpact,
    exerciseElementKeys,
    type IncomingSetIdentities,
    type SrsIdentity,
} from "./update-impact";

function incoming(
    spec: Record<string, Record<string, string[]>>,
): IncomingSetIdentities {
    const byLesson = new Map<string, Map<string, Set<string>>>();
    for (const [lesson, exs] of Object.entries(spec)) {
        const byEx = new Map<string, Set<string>>();
        for (const [exId, keys] of Object.entries(exs)) {
            byEx.set(exId, new Set(keys));
        }
        byLesson.set(lesson, byEx);
    }
    return {lessons: new Set(Object.keys(spec)), byLesson};
}

const srs = (over: Partial<SrsIdentity> = {}): SrsIdentity => ({
    lesson_id: "01-greetings.json",
    exercise_id: "ex-match-1",
    element_key: "merci",
    ...over,
});

describe("computeUpdateImpact (#2128)", () => {
    it("no progress -> never breaking, even when content changed", () => {
        const impact = computeUpdateImpact([], [], incoming({"01.json": {}}));
        expect(impact.breaking).toBe(false);
    });

    it("a superset update (added variant / new exercise) is NOT breaking", () => {
        const impact = computeUpdateImpact(
            ["01-greetings.json"],
            [srs({exercise_id: "ex-match-1", element_key: "merci"})],
            incoming({
                "01-greetings.json": {
                    "ex-match-1": ["merci", "de rien"], // key still present
                    "ex-match-2": ["nouveau"], // added exercise
                },
            }),
        );
        expect(impact.breaking).toBe(false);
        expect(impact.lostCards).toHaveLength(0);
    });

    it("positional exercise_id shift orphans the SRS card (insert/reorder)", () => {
        const impact = computeUpdateImpact(
            ["01-greetings.json"],
            [srs({exercise_id: "ex-match-1", element_key: "gestern"})],
            // the element is now under ex-match-2; ex-match-1 holds something else
            incoming({
                "01-greetings.json": {
                    "ex-match-0": ["heute"],
                    "ex-match-2": ["gestern"],
                },
            }),
        );
        expect(impact.breaking).toBe(true);
        expect(impact.lostCards).toHaveLength(1);
    });

    it("element_key (answer) change orphans the SRS card even with the same exercise_id", () => {
        const impact = computeUpdateImpact(
            ["01-greetings.json"],
            [srs({exercise_id: "ex-pic-1", element_key: "さようなら"})],
            incoming({
                "01-greetings.json": {"ex-pic-1": ["さようなら (sayounara)"]},
            }),
        );
        expect(impact.breaking).toBe(true);
        expect(impact.lostCards[0].element_key).toBe("さようなら");
    });

    it("renamed lesson file orphans the progress row", () => {
        const impact = computeUpdateImpact(
            ["01-intro.json"],
            [],
            incoming({"01-greetings.json": {}}),
        );
        expect(impact.breaking).toBe(true);
        expect(impact.lostLessons).toEqual(["01-intro.json"]);
    });

    it("counts distinct lost lessons once", () => {
        const impact = computeUpdateImpact(
            ["01-intro.json", "01-intro.json", "02-keep.json"],
            [],
            incoming({"02-keep.json": {}}),
        );
        expect(impact.lostLessons).toEqual(["01-intro.json"]);
    });
});

describe("exerciseElementKeys mirrors element-attempt.ts for shipped types", () => {
    it("matching -> each pair.left", () => {
        expect(
            exerciseElementKeys({
                type: "matching",
                pairs: [{left: "merci"}, {left: "bonjour"}],
            }),
        ).toEqual(new Set(["merci", "bonjour"]));
    });
    it("free_text -> accept[0]", () => {
        expect(
            exerciseElementKeys({type: "free_text", accept: ["merci", "danke"]}),
        ).toEqual(new Set(["merci"]));
    });
    it("word_tiles -> tiles joined", () => {
        expect(
            exerciseElementKeys({type: "word_tiles", tiles: ["je", "suis"]}),
        ).toEqual(new Set(["je suis"]));
    });
    it("picture_choice -> the correct image label only", () => {
        expect(
            exerciseElementKeys({
                type: "picture_choice",
                images: [
                    {label: "さようなら", is_correct: "true"},
                    {label: "こんにちは", is_correct: undefined},
                ],
            }),
        ).toEqual(new Set(["さようなら"]));
    });
    it("cloze -> each blank.accept[0]", () => {
        expect(
            exerciseElementKeys({
                type: "cloze",
                blanks: [{accept: ["stai"]}, {accept: ["bene"]}],
            }),
        ).toEqual(new Set(["stai", "bene"]));
    });
    it("an UNHANDLED type yields an empty set (conservatively at-risk)", () => {
        // graded_quiz etc. are not derived here -> empty -> any SRS row on it
        // fails the resolve check -> flagged, never silently passed.
        expect(exerciseElementKeys({type: "graded_quiz"})).toEqual(new Set());
    });
});

describe("buildIncomingIdentities + computeUpdateImpact (end to end)", () => {
    it("a picture_choice label rewrite (the ja/ko/zh incident) is breaking", () => {
        const incomingIds = buildIncomingIdentities([
            {
                filename: "01-begruessungen.json",
                exercises: [
                    {
                        id: "ex-pic-1",
                        type: "picture_choice",
                        images: [{label: "さようなら (sayounara)", is_correct: "true"}],
                    },
                ],
            },
        ]);
        const impact = computeUpdateImpact(
            ["01-begruessungen.json"],
            [{lesson_id: "01-begruessungen.json", exercise_id: "ex-pic-1", element_key: "さようなら"}],
            incomingIds,
        );
        expect(impact.breaking).toBe(true);
        expect(impact.lostCards).toHaveLength(1);
    });

    it("an SRS row on an unhandled exercise type is conservatively flagged", () => {
        const incomingIds = buildIncomingIdentities([
            {filename: "L1", exercises: [{id: "ex-q", type: "graded_quiz"}]},
        ]);
        const impact = computeUpdateImpact(
            [],
            [{lesson_id: "L1", exercise_id: "ex-q", element_key: "whatever"}],
            incomingIds,
        );
        expect(impact.breaking).toBe(true);
    });
});
