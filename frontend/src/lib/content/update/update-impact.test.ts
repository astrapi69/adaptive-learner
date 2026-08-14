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
                pairs: [{left: "merci", right: "danke"}, {left: "bonjour", right: "hallo"}],
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
                    {label: "さようなら", is_correct: "true", src: "a.png"},
                    {label: "こんにちは", src: "b.png"},
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
    it("an UNKNOWN type yields null (conservatively at-risk) (#2303)", () => {
        // An undeclared extension has no rule, so the guard cannot decide:
        // any SRS row on it fails the resolve check and is flagged, never
        // silently passed. The ADOPTED types are covered since #2303 and no
        // longer land here.
        expect(exerciseElementKeys({type: "ext:acme-ordering"})).toBeNull();
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
                        images: [{label: "さようなら (sayounara)", is_correct: "true", src: "a.png"}],
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

    it("an SRS row on an UNDECLARED extension type is conservatively flagged", () => {
        const incomingIds = buildIncomingIdentities([
            {filename: "L1", exercises: [{id: "ex-q", type: "ext:acme-ordering"}]},
        ]);
        const impact = computeUpdateImpact(
            [],
            [{lesson_id: "L1", exercise_id: "ex-q", element_key: "whatever"}],
            incomingIds,
        );
        expect(impact.breaking).toBe(true);
    });
});

/**
 * #2303 regression. Before the fix the guard derived keys for five of the
 * thirteen shipped types; a learner with rows on any other type had EVERY
 * update reported as breaking, so the auto-sync held the set forever and the
 * manual dialog cried wolf on a no-op. Each case below applies an update whose
 * content is UNCHANGED and asserts the guard stays quiet.
 */
describe("a harmless update is not breaking, for every shipped type (#2303)", () => {
    const cases: [string, Record<string, unknown>, string][] = [
        [
            "ext:al-graded-quiz",
            {
                type: "ext:al-graded-quiz",
                ext_payload: {
                    questions: [
                        {prompt: "Hauptstadt?", type: "free_text", accept: ["Berlin"], points: 1},
                    ],
                },
            },
            "Berlin",
        ],
        [
            "ext:al-dictation",
            {
                type: "ext:al-dictation",
                ext_payload: {audio: "assets/a.mp3", accept: ["Guten Morgen"]},
            },
            "Guten Morgen",
        ],
        [
            "ext:al-image-description",
            {
                type: "ext:al-image-description",
                ext_payload: {image: "assets/a.png", accept: ["Ein Hund laeuft."]},
            },
            "Ein Hund laeuft.",
        ],
        [
            "ext:al-categorization",
            {
                type: "ext:al-categorization",
                ext_payload: {categories: [{name: "Verb", items: ["laufen"]}]},
            },
            "laufen",
        ],
        [
            "ext:al-error-correction",
            {
                type: "ext:al-error-correction",
                ext_payload: {
                    tokens: ["Ich", "gehe", "zu", "Hause"],
                    error_index: 2,
                    accept: ["nach"],
                },
            },
            "nach",
        ],
        [
            "ext:al-reading-comprehension",
            {
                type: "ext:al-reading-comprehension",
                ext_payload: {
                    passage: "Paul wohnt in Lyon.",
                    questions: [
                        {prompt: "Wo?", type: "free_text", accept: ["Lyon"]},
                    ],
                },
            },
            "Lyon",
        ],
        [
            "multiple_choice",
            {
                type: "multiple_choice",
                options: [
                    {text: "un", correct: true},
                    {text: "deux", correct: false},
                ],
            },
            "un",
        ],
        [
            "cloze multiselect",
            {
                type: "cloze",
                cloze_mode: "multiselect",
                sentence: "Welche sind Verben?",
                accept: ["essen", "laufen"],
            },
            "essen, laufen",
        ],
    ];

    for (const [name, exercise, key] of cases) {
        it(`${name}: an unchanged update leaves the SRS row resolvable`, () => {
            const incomingIds = buildIncomingIdentities([
                {filename: "L1", exercises: [{id: "ex-1", ...exercise}]},
            ]);
            const impact = computeUpdateImpact(
                [],
                [{lesson_id: "L1", exercise_id: "ex-1", element_key: key}],
                incomingIds,
            );
            expect(impact.lostCards).toEqual([]);
            expect(impact.breaking).toBe(false);
        });
    }

    it("still reports a REAL element change on a newly covered type", () => {
        const incomingIds = buildIncomingIdentities([
            {
                filename: "L1",
                exercises: [
                    {
                        id: "ex-1",
                        type: "ext:al-dictation",
                        ext_payload: {audio: "assets/a.mp3", accept: ["Guten Morgen!"]},
                    },
                ],
            },
        ]);
        const impact = computeUpdateImpact(
            [],
            [{lesson_id: "L1", exercise_id: "ex-1", element_key: "Guten Morgen"}],
            incomingIds,
        );
        expect(impact.breaking).toBe(true);
    });
});

// --- #2130 stable_id key switch --------------------------------------------

describe("buildIncomingIdentities with stable_id (#2130)", () => {
    const lesson = {
        filename: "01-greetings.json",
        exercises: [
            {
                id: "ex-match-1",
                stable_id: "greetings-match-x7",
                type: "matching",
                pairs: [{left: "merci", right: "danke"}],
            },
        ],
    };

    it("a row keyed by stable_id resolves (post-switch rows)", () => {
        const impact = computeUpdateImpact(
            [],
            [srs({exercise_id: "greetings-match-x7", element_key: "merci"})],
            buildIncomingIdentities([lesson]),
        );
        expect(impact.breaking).toBe(false);
        expect(impact.lostCards).toEqual([]);
    });

    it("a row keyed by the authored id STILL resolves (pre-switch rows)", () => {
        const impact = computeUpdateImpact(
            [],
            [srs({exercise_id: "ex-match-1", element_key: "merci"})],
            buildIncomingIdentities([lesson]),
        );
        expect(impact.breaking).toBe(false);
        expect(impact.lostCards).toEqual([]);
    });

    it("an unknown identity is still lost", () => {
        const impact = computeUpdateImpact(
            [],
            [srs({exercise_id: "ex-gone", element_key: "merci"})],
            buildIncomingIdentities([lesson]),
        );
        expect(impact.breaking).toBe(true);
    });
});

// --- engine#91 element-level stable_id key switch ---------------------------

describe("exerciseElementKeys prefers element-level stable_id (engine#91)", () => {
    it("matching: a pair's own stable_id, not its content-derived text", () => {
        expect(
            exerciseElementKeys({
                type: "matching",
                pairs: [{left: "merci", right: "danke", stable_id: "pair-aaaa0001"}],
            }),
        ).toEqual(new Set(["pair-aaaa0001"]));
    });

    it("agrees with remap-plan's switch: a row keyed by an element stable_id resolves against corrected content", () => {
        const incomingIds = buildIncomingIdentities([
            {
                filename: "01.json",
                exercises: [
                    {
                        id: "ex-match-1",
                        type: "matching",
                        pairs: [{left: "bonjour (corrige)", right: "hallo", stable_id: "pair-aaaa0001"}],
                    },
                ],
            },
        ]);
        const impact = computeUpdateImpact(
            [],
            [{lesson_id: "01.json", exercise_id: "ex-match-1", element_key: "pair-aaaa0001"}],
            incomingIds,
        );
        expect(impact.breaking).toBe(false);
        expect(impact.lostCards).toEqual([]);
    });
});

// --- #2188 retired_ids classification ----------------------------------------

describe("computeUpdateImpact with retired_ids (#2188)", () => {
    it("a retired identity is archived-class, not breaking", () => {
        const impact = computeUpdateImpact(
            [],
            [srs({exercise_id: "greetings-match-x7", element_key: "merci"})],
            incoming({"01-greetings.json": {}}),
            ["greetings-match-x7"],
        );
        expect(impact.breaking).toBe(false);
        expect(impact.lostCards).toEqual([]);
        expect(impact.retiredCards).toEqual([
            {lesson_id: "01-greetings.json", exercise_id: "greetings-match-x7", element_key: "merci"},
        ]);
    });

    it("a non-retired lost identity still breaks (mixed update)", () => {
        const impact = computeUpdateImpact(
            [],
            [
                srs({exercise_id: "greetings-match-x7", element_key: "merci"}),
                srs({exercise_id: "ex-gone", element_key: "bonjour"}),
            ],
            incoming({"01-greetings.json": {}}),
            ["greetings-match-x7"],
        );
        expect(impact.breaking).toBe(true);
        expect(impact.lostCards.map((c) => c.exercise_id)).toEqual(["ex-gone"]);
        expect(impact.retiredCards.map((c) => c.exercise_id)).toEqual(["greetings-match-x7"]);
    });

    it("without retired_ids nothing is classified retired", () => {
        const impact = computeUpdateImpact(
            [],
            [srs({exercise_id: "ex-gone", element_key: "merci"})],
            incoming({"01-greetings.json": {}}),
        );
        expect(impact.retiredCards).toEqual([]);
        expect(impact.breaking).toBe(true);
    });
});
