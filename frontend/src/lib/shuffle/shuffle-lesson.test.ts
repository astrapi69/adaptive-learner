import {describe, it, expect} from "vitest";

import {
    DEFAULT_SHUFFLE_LIMIT,
    MAX_CONSECUTIVE_SAME_LESSON,
    buildShuffleLesson,
    distinctSourceLessonCount,
    type ShuffleSourceLesson,
} from "./shuffle-lesson";
import type {ContentLesson, ContentLessonStep} from "../../storage/types";

function exerciseStep(id: string): ContentLessonStep {
    return {
        id,
        type: "exercise",
        title: null,
        exercise: {
            id,
            type: "free_text",
            prompt: `Prompt ${id}`,
            card_ids: [`card-${id}`],
            accept: ["x"],
        },
    } as ContentLessonStep;
}

function theoryStep(id: string): ContentLessonStep {
    return {id, type: "theory", title: id, body: "theory"} as ContentLessonStep;
}

function lessonFixture(
    lessonId: string,
    exerciseCount: number,
    opts: {withTheory?: boolean} = {},
): ShuffleSourceLesson {
    const steps: ContentLessonStep[] = [];
    if (opts.withTheory) steps.push(theoryStep(`${lessonId}-theory`));
    for (let i = 0; i < exerciseCount; i++) {
        steps.push(exerciseStep(`${lessonId}-ex${i}`));
    }
    const lesson: ContentLesson = {
        id: lessonId,
        title: `Lesson ${lessonId}`,
        estimated_minutes: 5,
        cards: Array.from({length: exerciseCount}, (_, i) => ({
            id: `card-${lessonId}-ex${i}`,
            front: `front ${i}`,
            back: `back ${i}`,
        })) as ContentLesson["cards"],
        steps,
    };
    return {lessonId, title: `Lesson ${lessonId}`, lesson};
}

/** A deterministic RNG: replays a fixed sequence of [0,1) values, cycling. */
function seededRng(seq: number[]): () => number {
    let i = 0;
    return () => seq[i++ % seq.length];
}

describe("buildShuffleLesson (#1014)", () => {
    it("pools exercises from every lesson and drops theory steps", () => {
        const lesson = buildShuffleLesson(
            [lessonFixture("a", 3, {withTheory: true}), lessonFixture("b", 2)],
            {title: "Shuffle", rng: seededRng([0.5])},
        );
        expect(lesson.steps).toHaveLength(5);
        for (const step of lesson.steps) {
            expect(step.type).toBe("exercise");
            // Every step is source-tagged for the SRS recorder + summary.
            expect(step.review_lesson_id === "a" || step.review_lesson_id === "b").toBe(true);
        }
    });

    it("defaults the session length to 20 and caps to it", () => {
        const lesson = buildShuffleLesson(
            [lessonFixture("a", 15), lessonFixture("b", 15)],
            {title: "Shuffle", rng: seededRng([0.1, 0.9, 0.4, 0.6])},
        );
        expect(lesson.steps).toHaveLength(DEFAULT_SHUFFLE_LIMIT);
    });

    it("honours an explicit limit", () => {
        const lesson = buildShuffleLesson(
            [lessonFixture("a", 15), lessonFixture("b", 15)],
            {title: "Shuffle", limit: 10, rng: seededRng([0.3])},
        );
        expect(lesson.steps).toHaveLength(10);
    });

    it("never places more than 3 consecutive from the same lesson", () => {
        // Two lessons of 25 exercises each → a naive shuffle would routinely
        // produce 4+ runs; the repair pass must break them.
        const lesson = buildShuffleLesson(
            [lessonFixture("a", 25), lessonFixture("b", 25)],
            {title: "Shuffle", limit: 50, rng: seededRng([0.99, 0.01, 0.5, 0.27, 0.73])},
        );
        let run = 1;
        for (let i = 1; i < lesson.steps.length; i++) {
            if (
                lesson.steps[i].review_lesson_id ===
                lesson.steps[i - 1].review_lesson_id
            ) {
                run += 1;
                expect(run).toBeLessThanOrEqual(MAX_CONSECUTIVE_SAME_LESSON);
            } else {
                run = 1;
            }
        }
    });

    it("allows a run up to 3 when one lesson dominates", () => {
        // Only lesson 'a' contributes beyond the first few → unavoidable runs
        // are accepted (the repair can't break a run with no other lesson).
        const lesson = buildShuffleLesson(
            [lessonFixture("a", 10), lessonFixture("b", 1)],
            {title: "Shuffle", limit: 11, rng: seededRng([0.5])},
        );
        expect(lesson.steps.length).toBe(11);
    });

    it("unions the source lessons' cards by id", () => {
        const lesson = buildShuffleLesson(
            [lessonFixture("a", 2), lessonFixture("b", 3)],
            {title: "Shuffle", rng: seededRng([0.5])},
        );
        // 2 + 3 distinct cards.
        expect(lesson.cards).toHaveLength(5);
    });

    it("is deterministic for a fixed RNG sequence", () => {
        const sources = [lessonFixture("a", 6), lessonFixture("b", 6)];
        const seq = [0.12, 0.84, 0.33, 0.57, 0.91, 0.05];
        const first = buildShuffleLesson(sources, {
            title: "Shuffle",
            rng: seededRng(seq),
        });
        const second = buildShuffleLesson(sources, {
            title: "Shuffle",
            rng: seededRng(seq),
        });
        expect(first.steps.map((s) => s.id)).toEqual(
            second.steps.map((s) => s.id),
        );
    });

    it("returns zero steps when no lesson contributes exercises", () => {
        const lesson = buildShuffleLesson(
            [lessonFixture("a", 0, {withTheory: true})],
            {title: "Shuffle", rng: seededRng([0.5])},
        );
        expect(lesson.steps).toHaveLength(0);
    });

    it("counts distinct source lessons in the synthesised steps", () => {
        const lesson = buildShuffleLesson(
            [lessonFixture("a", 3), lessonFixture("b", 3), lessonFixture("c", 3)],
            {title: "Shuffle", rng: seededRng([0.5])},
        );
        expect(distinctSourceLessonCount(lesson.steps)).toBe(3);
    });
});
