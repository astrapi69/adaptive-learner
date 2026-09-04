/**
 * srs mutation pins (#2746) — parametrized tables aimed at the surviving
 * mutants of the 2026-08-25 scoped Stryker run (51.5% score, 144 source
 * survivors incl. no-coverage lines). Every table row targets at least one
 * named mutant class from that report; the speaking ids carry the case
 * (quality-checks.md "Parametrized tests").
 *
 * DOCUMENTED-EQUIVALENT clusters (not chased, per quality-checks.md
 * "surviving mutants in trivial code: ignore or document"):
 *
 * - "?? fallback duplication": several derivers compute
 *   ``elementKeysOf(x)?.[0] ?? <inline same rule>`` — the fallback re-derives
 *   the identical value, so mutants swapping ``??`` for ``&&`` or dropping a
 *   branch produce the same output by construction (element-attempt L233,
 *   L320, L352/L358 canonical half, categorization L128 ``?? item`` +
 *   ``index--``: keys are the flatMapped items themselves).
 * - "type-unreachable optional chaining": ``pair?.left`` etc. where the
 *   element type makes the array entry non-nullable — a sparse entry cannot
 *   be constructed without ``any`` (element-keys L100/109/113/119/120
 *   entry-level ``?.`` variants; element-identity L34/L42/L53/L54 same).
 * - element-identity L69 ``canonical === null`` guard: for every type whose
 *   rule exists, canonical is non-null; for unknown types the switch default
 *   returns the same ``null`` — both paths agree on every reachable input.
 * - status L155 parenthesization variant of the two-step ``??`` chain: JS
 *   left-associates ``a ?? b ?? c`` exactly as ``(a ?? b) ?? c``.
 * - status L97 ``<`` -> ``<=``: fires only on exactly-equal candidates,
 *   where both operators keep the same value.
 * - "short-circuited fallback expression": the right side of a
 *   ``?? ""`` / ``?? []`` whose left side is non-null on every reachable
 *   input never evaluates, so its literal mutants read as NoCoverage even
 *   though the LINE is covered (element-attempt's remaining NoCoverage
 *   entries are exactly these).
 *
 * Verified effect of this file (scoped Stryker re-runs, 2026-08-25):
 * source-file survivors 144 -> 70; per file (score before -> after):
 * status 63.8 -> 95.7, mastery 88.9 -> 100, exam-attempt 88.9 -> 100,
 * element-keys 77.5 -> 90.1, element-attempt 65.8 -> 77.6,
 * element-identity 76.0 -> 78.0 (its tail is the type-unreachable class
 * above). The remainder maps onto the documented classes.
 */

import {describe, expect, it} from "vitest";

import {
    deriveCategorizationAttempts,
    deriveClozeAttempts,
    deriveClozeMultiSelectAttempt,
    deriveDictationAttempt,
    deriveErrorCorrectionAttempt,
    deriveFreeTextAttempt,
    deriveGradedQuizAttempts,
    deriveImageDescriptionAttempt,
    deriveMatchingAttempts,
    deriveMultipleChoiceAttempt,
    derivePictureChoiceAttempt,
    deriveReadingComprehensionAttempts,
    deriveWordTilesAttempt,
    type AttemptContext,
} from "./element-attempt";
import {elementIdentityKeysOf} from "./element-identity";
import {elementKeysOf, type KeyBearingExercise} from "./element-keys";
import {stampExamAttempts} from "./exam-attempt";
import {isFullyMastered, masteryCounts, PRODUCTIVE, RECEPTIVE} from "./mastery";
import {
    elementSrsDetails,
    intervalForStreak,
    SRS_SCHEDULE,
    srsLessonSummary,
} from "./status";
import type {
    ContentLessonExercise,
    ElementAttempt,
    ElementError,
} from "../../storage/types";

const NOW = new Date("2026-02-01T00:00:00Z");
const CTX: AttemptContext = {setId: "es-a1", lessonId: "01.json"};

function ee(over: Partial<ElementError>): ElementError {
    return {
        id: "e",
        user_id: "u",
        set_id: "es-a1",
        lesson_id: "01.json",
        exercise_id: "ex",
        element_key: "el libro",
        element_type: "card",
        user_answer: "la libro",
        correct_answer: "el libro",
        error_count: 1,
        correct_streak: 0,
        last_error_at: "2026-01-01T00:00:00Z",
        last_attempt_at: "2026-01-01T00:00:00Z",
        mastered: false,
        mastered_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        ...over,
    } as ElementError;
}

function ex(over: Partial<ContentLessonExercise>): ContentLessonExercise {
    return {id: "ex-1", type: "free_text", prompt: "p", ...over} as ContentLessonExercise;
}

describe("#2746 status.ts: SRS_SCHEDULE is pinned content, not shape", () => {
    it("has exactly the three bands", () => {
        expect(SRS_SCHEDULE).toHaveLength(3);
    });

    it.each([
        ["band-0-learning", 0, false, 1],
        ["band-1-first-success", 1, false, 3],
        ["band-2-open-ended", 2, true, 7],
    ])("%s: streak %i openEnded=%s days=%i", (_id, streak, openEnded, days) => {
        expect(SRS_SCHEDULE[streak]).toEqual({streak, openEnded, days});
        expect(intervalForStreak(streak)).toBe(days);
    });
});

describe("#2746 status.ts: due/nextReview boundaries", () => {
    it("counts a review due at EXACTLY now (<= not <)", () => {
        const s = srsLessonSummary(
            [ee({last_attempt_at: "2026-01-31T00:00:00Z", correct_streak: 0})],
            NOW,
        );
        expect(s.due).toBe(1);
        expect(s.status).toBe("due");
    });

    it("nextReviewAt tracks the minimum across rows (earlier-first order)", () => {
        const s = srsLessonSummary(
            [
                ee({last_attempt_at: "2026-02-02T00:00:00Z", correct_streak: 0}),
                ee({last_attempt_at: "2026-02-05T00:00:00Z", correct_streak: 0}),
            ],
            NOW,
        );
        expect(s.nextReviewAt).toBe("2026-02-03T00:00:00.000Z");
    });
});

describe("#2746 status.ts: elementSrsDetails field fallbacks", () => {
    it.each([
        [
            "direction-missing-defaults-receptive",
            {direction: undefined},
            (d: ReturnType<typeof elementSrsDetails>[number]) =>
                expect(d.direction).toBe("target_to_source"),
        ],
        [
            "direction-present-passes-through",
            {direction: "source_to_target"},
            (d: ReturnType<typeof elementSrsDetails>[number]) =>
                expect(d.direction).toBe("source_to_target"),
        ],
        [
            "lastAnswer-missing-becomes-empty-string",
            {user_answer: undefined},
            (d: ReturnType<typeof elementSrsDetails>[number]) =>
                expect(d.lastAnswer).toBe(""),
        ],
        [
            "correctAnswer-missing-becomes-empty-string",
            {correct_answer: undefined},
            (d: ReturnType<typeof elementSrsDetails>[number]) =>
                expect(d.correctAnswer).toBe(""),
        ],
        [
            "attemptCount-falls-back-to-history-length",
            {
                attempt_count: undefined,
                attempt_history: [
                    {correct: false, answer: "x", at: "2026-01-01T00:00:00Z"},
                    {correct: true, answer: "y", at: "2026-01-02T00:00:00Z"},
                ],
            },
            (d: ReturnType<typeof elementSrsDetails>[number]) =>
                expect(d.attemptCount).toBe(2),
        ],
        [
            "attemptCount-prefers-explicit-count-over-history",
            {
                attempt_count: 5,
                attempt_history: [
                    {correct: true, answer: "y", at: "2026-01-02T00:00:00Z"},
                ],
            },
            (d: ReturnType<typeof elementSrsDetails>[number]) =>
                expect(d.attemptCount).toBe(5),
        ],
        [
            "attemptCount-zero-when-nothing-recorded",
            {attempt_count: undefined, attempt_history: undefined},
            (d: ReturnType<typeof elementSrsDetails>[number]) =>
                expect(d.attemptCount).toBe(0),
        ],
        [
            "lastAttemptCorrect-null-on-EMPTY-history",
            {attempt_history: []},
            (d: ReturnType<typeof elementSrsDetails>[number]) =>
                expect(d.lastAttemptCorrect).toBeNull(),
        ],
        [
            "lastAttemptCorrect-reads-the-LAST-entry",
            {
                attempt_history: [
                    {correct: false, answer: "x", at: "2026-01-01T00:00:00Z"},
                    {correct: true, answer: "y", at: "2026-01-02T00:00:00Z"},
                ],
            },
            (d: ReturnType<typeof elementSrsDetails>[number]) =>
                expect(d.lastAttemptCorrect).toBe(true),
        ],
        [
            "mastered-row-is-never-overdue",
            {mastered: true},
            (d: ReturnType<typeof elementSrsDetails>[number]) =>
                expect(d.overdue).toBe(false),
        ],
        [
            "overdue-true-at-exact-boundary",
            {last_attempt_at: "2026-01-31T00:00:00Z", correct_streak: 0},
            (d: ReturnType<typeof elementSrsDetails>[number]) =>
                expect(d.overdue).toBe(true),
        ],
    ])("%s", (_id, over, check) => {
        const [detail] = elementSrsDetails([ee(over as Partial<ElementError>)], NOW);
        check(detail);
    });

    it("overdue beats a higher error count in the ordering", () => {
        const details = elementSrsDetails(
            [
                ee({
                    element_key: "scheduled-9err",
                    last_attempt_at: "2026-01-31T00:00:00Z",
                    correct_streak: 2,
                    error_count: 9,
                }),
                ee({
                    element_key: "due-5err",
                    last_attempt_at: "2026-01-01T00:00:00Z",
                    error_count: 5,
                }),
            ],
            NOW,
        );
        expect(details.map((d) => d.elementKey)).toEqual([
            "due-5err",
            "scheduled-9err",
        ]);
    });
});

describe("#2746 mastery.ts: identity join + direction branches", () => {
    it("element identity is field-SEPARATED, not concatenated", () => {
        const counts = masteryCounts([
            ee({set_id: "ab", lesson_id: "c", mastered: true, direction: RECEPTIVE}),
            ee({set_id: "a", lesson_id: "bc", mastered: true, direction: PRODUCTIVE}),
        ]);
        expect(counts.fully).toBe(0);
        expect(counts.receptive).toBe(1);
        expect(counts.productive).toBe(1);
    });

    it("both directions on the SAME element count as fully mastered", () => {
        const counts = masteryCounts([
            ee({mastered: true, direction: RECEPTIVE}),
            ee({mastered: true, direction: PRODUCTIVE}),
        ]);
        expect(counts).toEqual({receptive: 1, productive: 1, fully: 1});
    });

    it.each([
        ["masteryCounts-ignores-unknown-direction", true],
        ["isFullyMastered-ignores-unknown-direction", false],
    ])("%s", (_id, viaCounts) => {
        const rows = [
            ee({mastered: true, direction: PRODUCTIVE}),
            ee({mastered: true, direction: "sideways"}),
        ];
        if (viaCounts) {
            const counts = masteryCounts(rows);
            expect(counts.receptive).toBe(0);
            expect(counts.fully).toBe(0);
        } else {
            expect(isFullyMastered(rows)).toBe(false);
        }
    });
});

describe("#2746 exam-attempt.ts: the non-exam path returns real copies", () => {
    it("copies every attempt untouched (deep-equal, distinct references)", () => {
        const attempts: ElementAttempt[] = [
            {
                set_id: "s",
                lesson_id: "l",
                exercise_id: "x",
                direction: "target_to_source",
                element_key: "k",
                element_type: "vocabulary",
                user_answer: "u",
                correct_answer: "c",
                correct: true,
            } as ElementAttempt,
        ];
        const out = stampExamAttempts(attempts, false);
        expect(out).toEqual(attempts);
        expect(out[0]).not.toBe(attempts[0]);
        expect(out[0].exam).toBeUndefined();
    });
});

describe("#2746 element-keys.ts: one table over the key rules", () => {
    it.each<[string, KeyBearingExercise, string[] | null]>([
        [
            "cloze-multiselect-sorts-and-joins",
            {type: "cloze", cloze_mode: "multiselect", accept: ["b", "a"]},
            ["a, b"],
        ],
        [
            "cloze-multiselect-empty-accept",
            {type: "cloze", cloze_mode: "multiselect"},
            [""],
        ],
        [
            "cloze-blank-accepts-first-entry-and-empty-fallback",
            {
                type: "cloze",
                cloze_mode: "type",
                blanks: [{accept: ["uno", "1"]}, {accept: []}],
            },
            ["uno", ""],
        ],
        ["cloze-without-blanks-contributes-nothing", {type: "cloze"}, []],
        [
            "matching-keys-are-the-left-column",
            {type: "matching", pairs: [{left: "merci", right: "danke"}]},
            ["merci"],
        ],
        ["matching-without-pairs-contributes-nothing", {type: "matching"}, []],
        [
            "picture-choice-only-correct-images-count",
            {
                type: "picture_choice",
                images: [
                    {src: "a/d.png", label: "dog", is_correct: "true"},
                    {src: "a/c.png", label: "cat", is_correct: "false"},
                    {src: "a/o.png", label: "owl"},
                ],
            },
            ["dog"],
        ],
        ["picture-choice-without-images", {type: "picture_choice"}, []],
        [
            "multiple-choice-correct-options-sorted-joined",
            {
                type: "multiple_choice",
                options: [
                    {text: "zeta", correct: true},
                    {text: "alpha", correct: true},
                    {text: "nope", correct: false},
                    {text: "undecided"},
                ],
            },
            ["alpha, zeta"],
        ],
        ["multiple-choice-without-options", {type: "multiple_choice"}, [""]],
        ["free-text-accept-first", {type: "free_text", accept: ["hola", "buenas"]}, ["hola"]],
        ["free-text-without-accept", {type: "free_text"}, [""]],
        ["word-tiles-joined-phrase", {type: "word_tiles", tiles: ["el", "libro"]}, ["el libro"]],
        ["word-tiles-without-tiles", {type: "word_tiles"}, [""]],
        ["unknown-core-type-is-at-risk-null", {type: "hologram"}, null],
        ["unknown-ext-type-is-at-risk-null", {type: "ext:acme-ordering"}, null],
        ["missing-type-is-at-risk-null", {}, null],
        [
            "ext-error-correction-without-payload-falls-to-empty",
            {type: "ext:al-error-correction"},
            [""],
        ],
        [
            "ext-categorization-without-payload-contributes-nothing",
            {type: "ext:al-categorization"},
            [],
        ],
        [
            "ext-reading-comprehension-without-payload-contributes-nothing",
            {type: "ext:al-reading-comprehension"},
            [],
        ],
        [
            "ext-graded-quiz-without-payload-contributes-nothing",
            {type: "ext:al-graded-quiz"},
            [],
        ],
    ])("%s", (_id, exercise, expected) => {
        expect(elementKeysOf(exercise)).toEqual(expected);
    });
});

describe("#2746 element-identity.ts: stable_id preferred, canonical fallback", () => {
    it.each<[string, KeyBearingExercise, string[] | null]>([
        [
            "matching-mixed-minting",
            {
                type: "matching",
                pairs: [
                    {left: "merci", right: "danke", stable_id: "pair-x1"},
                    {left: "bonjour", right: "hallo"},
                ],
            },
            ["pair-x1", "bonjour"],
        ],
        ["matching-without-pairs", {type: "matching"}, []],
        [
            "cloze-mixed-minting",
            {
                type: "cloze",
                cloze_mode: "type",
                blanks: [{accept: ["uno"], stable_id: "blank-7"}, {accept: ["dos"]}],
            },
            ["blank-7", "dos"],
        ],
        [
            "cloze-multiselect-keeps-the-collapsed-canonical",
            {type: "cloze", cloze_mode: "multiselect", accept: ["b", "a"]},
            ["a, b"],
        ],
        [
            "multiple-choice-substitutes-minted-ids-before-sort-join",
            {
                type: "multiple_choice",
                options: [
                    {text: "zeta", correct: true, stable_id: "opt-1"},
                    {text: "alpha", correct: true},
                    {text: "nope", correct: false, stable_id: "opt-9"},
                ],
            },
            ["alpha, opt-1"],
        ],
        ["unknown-type-stays-null", {type: "hologram"}, null],
        [
            "non-identity-type-passes-canonical-through",
            {type: "free_text", accept: ["hola"]},
            ["hola"],
        ],
    ])("%s", (_id, exercise, expected) => {
        expect(elementIdentityKeysOf(exercise)).toEqual(expected);
    });
});

describe("#2746 element-attempt.ts: matching fan-out", () => {
    const matching = ex({
        id: "ex-m",
        type: "matching",
        direction: "target_to_source",
        pairs: [
            {left: "libro", right: "el", stable_id: "p-1"},
            {left: "coche", right: "el"},
            {left: "casa", right: "la"},
        ],
    });

    it("stamps base fields, identity keys and duplicate-value correctness", () => {
        const attempts = deriveMatchingAttempts(
            matching,
            CTX,
            new Map([
                [0, 1],
                [2, 2],
            ]),
        );
        expect(attempts).toHaveLength(3);
        expect(attempts[0]).toMatchObject({
            set_id: "es-a1",
            lesson_id: "01.json",
            exercise_id: "ex-m",
            direction: "target_to_source",
            element_key: "p-1",
            element_type: "vocabulary",
            user_answer: "el",
            correct_answer: "el",
            correct: true,
        });
        expect(attempts[1]).toMatchObject({
            element_key: "coche",
            user_answer: "",
            correct: false,
        });
        expect(attempts[2]).toMatchObject({
            element_key: "casa",
            user_answer: "la",
            correct: true,
        });
    });

    it("productive drills compare the LEFT values instead", () => {
        const attempts = deriveMatchingAttempts(
            matching,
            CTX,
            new Map([[0, 1]]),
            true,
        );
        expect(attempts[0].correct).toBe(false);
    });

    it("an exercise without pairs fans out to nothing", () => {
        const attempts = deriveMatchingAttempts(
            ex({type: "matching", direction: "target_to_source"}),
            CTX,
            new Map(),
        );
        expect(attempts).toEqual([]);
    });
});

describe("#2746 element-attempt.ts: categorization fan-out", () => {
    const categorization = ex({
        id: "ex-c",
        type: "ext:al-categorization",
        direction: "target_to_source",
        ext_payload: {
            categories: [
                {name: "obst", items: ["apfel", "birne"]},
                {name: "tier", items: ["hund"]},
            ],
        },
    });

    it("one attempt per item with per-item verdicts", () => {
        const attempts = deriveCategorizationAttempts(
            categorization,
            CTX,
            new Map([
                ["apfel", "obst"],
                ["birne", "tier"],
            ]),
        );
        expect(attempts.map((a) => [a.element_key, a.user_answer, a.correct])).toEqual([
            ["apfel", "obst", true],
            ["birne", "tier", false],
            ["hund", "", false],
        ]);
        expect(attempts[0].correct_answer).toBe("obst");
        expect(attempts[2].correct_answer).toBe("tier");
    });

    it("a malformed payload yields no attempts", () => {
        expect(
            deriveCategorizationAttempts(
                ex({type: "ext:al-categorization", direction: "target_to_source"}),
                CTX,
                new Map(),
            ),
        ).toEqual([]);
    });
});

describe("#2746 element-attempt.ts: error correction", () => {
    it("formats both answer sides from the payload", () => {
        const attempt = deriveErrorCorrectionAttempt(
            ex({
                id: "ex-e",
                type: "ext:al-error-correction",
                direction: "target_to_source",
                ext_payload: {
                    tokens: ["ich", "gehen", "heim"],
                    error_index: 1,
                    accept: ["gehe"],
                },
            }),
            CTX,
            {pickedIndex: 2, typedCorrection: "gehte"},
            false,
        );
        expect(attempt).toMatchObject({
            element_key: "gehe",
            element_type: "grammar_rule",
            user_answer: "heim -> gehte",
            correct_answer: "gehen -> gehe",
            correct: false,
        });
    });

    it("a missing payload degrades to empty strings, not a crash", () => {
        const attempt = deriveErrorCorrectionAttempt(
            ex({type: "ext:al-error-correction", direction: "target_to_source"}),
            CTX,
            {pickedIndex: 0, typedCorrection: "x"},
            true,
        );
        expect(attempt.element_key).toBe("");
        expect(attempt.user_answer).toBe(" -> x");
        expect(attempt.correct_answer).toBe(" -> ");
        expect(attempt.correct).toBe(true);
    });
});

describe("#2746 element-attempt.ts: question-list derivers", () => {
    const rcExercise = ex({
        id: "ex-r",
        type: "ext:al-reading-comprehension",
        direction: "target_to_source",
        ext_payload: {
            passage: "...",
            questions: [
                {prompt: "q1", type: "free_text", accept: ["a1"]},
                {prompt: "q2", type: "free_text", accept: ["a2"]},
            ],
        },
    });
    const quizExercise = ex({
        id: "ex-q",
        type: "ext:al-graded-quiz",
        direction: "target_to_source",
        ext_payload: {
            questions: [
                {prompt: "q1", type: "free_text", accept: ["a1"], points: 1},
                {prompt: "q2", type: "free_text", accept: ["a2"], points: 1},
            ],
        },
    });

    it.each([
        ["reading-comprehension", () =>
            deriveReadingComprehensionAttempts(rcExercise, CTX, [
                {answer: "a1", correct: true},
            ])],
        ["graded-quiz", () =>
            deriveGradedQuizAttempts(quizExercise, CTX, [
                {answer: "a1", correct: true},
            ])],
    ])("%s: a missing result row means empty+wrong, never undefined", (_id, run) => {
        const attempts = run();
        expect(attempts).toHaveLength(2);
        expect(attempts[0]).toMatchObject({user_answer: "a1", correct: true});
        expect(attempts[1]).toMatchObject({user_answer: "", correct: false});
        expect(attempts[1].element_type).toBe("vocabulary");
    });

    it.each([
        ["reading-comprehension", () =>
            deriveReadingComprehensionAttempts(
                ex({type: "ext:al-reading-comprehension", direction: "target_to_source"}),
                CTX,
                [],
            )],
        ["graded-quiz", () =>
            deriveGradedQuizAttempts(
                ex({type: "ext:al-graded-quiz", direction: "target_to_source"}),
                CTX,
                [],
            )],
    ])("%s: malformed payload yields no attempts", (_id, run) => {
        expect(run()).toEqual([]);
    });
});

describe("#2746 element-attempt.ts: single-attempt derivers", () => {
    const pictures = ex({
        id: "ex-p",
        type: "picture_choice",
        direction: "target_to_source",
        images: [
            {src: "assets/dog.png", label: "dog", is_correct: "false"},
            {src: "assets/owl.png", label: "owl", is_correct: "true"},
        ],
    });

    it.each([
        ["picked-the-correct-image", 1, "owl", true],
        ["picked-a-wrong-image", 0, "dog", false],
        ["picked-out-of-range", 7, "", false],
    ])("picture-choice %s", (_id, selectedIndex, userAnswer, correct) => {
        const attempt = derivePictureChoiceAttempt(pictures, CTX, selectedIndex);
        expect(attempt).toMatchObject({
            element_key: "owl",
            correct_answer: "owl",
            element_type: "vocabulary",
            user_answer: userAnswer,
            correct,
        });
    });

    it("free-text stamps the canonical on both key fields", () => {
        const attempt = deriveFreeTextAttempt(
            ex({id: "ex-f", type: "free_text", direction: "target_to_source", accept: ["hola"]}),
            CTX,
            "ola",
            false,
        );
        expect(attempt).toMatchObject({
            element_key: "hola",
            correct_answer: "hola",
            element_type: "vocabulary",
            user_answer: "ola",
            correct: false,
            exercise_id: "ex-f",
        });
    });

    it.each([
        ["dictation", () =>
            deriveDictationAttempt(
                ex({
                    type: "ext:al-dictation",
                    direction: "target_to_source",
                    ext_payload: {audio: "assets/a.mp3", accept: ["hola"]},
                }),
                CTX,
                "ola",
                false,
            )],
        ["image-description", () =>
            deriveImageDescriptionAttempt(
                ex({
                    type: "ext:al-image-description",
                    direction: "target_to_source",
                    ext_payload: {image: "i.png", accept: ["hola"]},
                }),
                CTX,
                "ola",
                false,
            )],
    ])("%s: canonical key + vocabulary type", (_id, run) => {
        const attempt = run();
        expect(attempt.element_key).toBe("hola");
        expect(attempt.correct_answer).toBe("hola");
        expect(attempt.element_type).toBe("vocabulary");
        expect(attempt.user_answer).toBe("ola");
    });

    it.each([
        ["multi-tile-is-grammar", ["el", "libro"], [1, 0], "libro el", "grammar_rule"],
        ["single-tile-is-vocabulary", ["hola"], [0], "hola", "vocabulary"],
        ["out-of-range-tile-becomes-empty", ["el", "libro"], [0, 9], "el ", "grammar_rule"],
    ])("word-tiles %s", (_id, tiles, placed, userAnswer, elementType) => {
        const attempt = deriveWordTilesAttempt(
            ex({type: "word_tiles", direction: "target_to_source", tiles}),
            CTX,
            placed,
            true,
        );
        expect(attempt.user_answer).toBe(userAnswer);
        expect(attempt.element_type).toBe(elementType);
        expect(attempt.element_key).toBe(tiles.join(" "));
    });
});

describe("#2746 element-attempt.ts: cloze + selection derivers", () => {
    it("cloze fan-out prefers blank stable_ids for storage, canonical for display", () => {
        const attempts = deriveClozeAttempts(
            ex({
                type: "cloze",
                cloze_mode: "type",
                direction: "target_to_source",
                blanks: [
                    {accept: ["uno"], stable_id: "blank-7"},
                    {accept: ["dos"]},
                ],
            }),
            CTX,
            ["uno"],
            [true],
        );
        expect(attempts.map((a) => [a.element_key, a.correct_answer])).toEqual([
            ["blank-7", "uno"],
            ["dos", "dos"],
        ]);
        expect(attempts[1]).toMatchObject({user_answer: "", correct: false});
        expect(attempts[0].element_type).toBe("vocabulary");
    });

    it.each([
        ["cloze-multiselect", () =>
            deriveClozeMultiSelectAttempt(
                ex({
                    type: "cloze",
                    cloze_mode: "multiselect",
                    direction: "target_to_source",
                    accept: ["b", "a"],
                }),
                CTX,
                ["b", "a"],
                true,
            ), "a, b", "a, b"],
        ["multiple-choice", () =>
            deriveMultipleChoiceAttempt(
                ex({
                    type: "multiple_choice",
                    direction: "target_to_source",
                    options: [
                        {text: "zeta", correct: true, stable_id: "opt-1"},
                        {text: "alpha", correct: true},
                    ],
                }),
                CTX,
                ["zeta", "alpha"],
                true,
            ), "alpha, zeta", "alpha, opt-1"],
    ])("%s: the user selection is sorted and joined", (_id, run, userAnswer, elementKey) => {
        const attempt = run();
        expect(attempt.user_answer).toBe(userAnswer);
        expect(attempt.element_key).toBe(elementKey);
        expect(attempt.element_type).toBe("vocabulary");
    });

    it("multiple-choice keeps correct_answer canonical while the key is minted", () => {
        const attempt = deriveMultipleChoiceAttempt(
            ex({
                type: "multiple_choice",
                direction: "target_to_source",
                options: [{text: "alpha", correct: true, stable_id: "opt-1"}],
            }),
            CTX,
            ["alpha"],
            true,
        );
        expect(attempt.element_key).toBe("opt-1");
        expect(attempt.correct_answer).toBe("alpha");
    });
});
