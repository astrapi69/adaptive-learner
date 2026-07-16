import {describe, expect, it} from "vitest";

import {generateExercises} from "./exercise-generator";
import {
    allChecksPass,
    buildLessonFromDraft,
    buildUserSetInput,
    checkDraft,
    draftSetId,
    type DraftLessonInput,
} from "./draft-to-lesson";
import type {LessonCardDraft, LessonMeta} from "./lesson-draft";

const META: LessonMeta = {
    title: "My French Basics",
    titleNative: "Bases du français",
    sourceLanguage: "de",
    targetLanguage: "fr",
    level: "A1",
    description: "A starter lesson.",
    author: "Aster",
};

function makeCards(n: number): LessonCardDraft[] {
    const w = ["chat", "chien", "oiseau", "poisson", "cheval", "lapin"];
    return Array.from({length: n}, (_u, i) => ({
        id: `c${i}`,
        front: w[i % w.length],
        back: `tier-${i}`,
        notes: "",
        image: "",
    }));
}

function input(cardCount = 5): DraftLessonInput {
    const cards = makeCards(cardCount);
    const exercises = generateExercises(
        cards.map((c) => ({id: c.id, front: c.front, back: c.back})),
        {count: 10, types: ["matching", "free_text"], direction: "auto"},
    );
    return {meta: META, cards, exercises};
}

describe("draft-to-lesson", () => {
    it("builds a valid ContentLesson (intro theory + exercise steps)", () => {
        const lesson = buildLessonFromDraft(input());
        expect(lesson.title).toBe("My French Basics");
        expect(lesson.target_language).toBe("fr");
        expect(lesson.source_language).toBe("de");
        expect(lesson.steps[0].type).toBe("theory");
        const exerciseSteps = lesson.steps.filter((s) => s.type === "exercise");
        expect(exerciseSteps.length).toBeGreaterThanOrEqual(5);
        expect(lesson.cards).toHaveLength(5);
        expect(lesson.contributed_by).toBe("Aster");
    });

    it("builds the SaveUserSetInput", () => {
        const i = input();
        const set = buildUserSetInput(i, buildLessonFromDraft(i));
        expect(set.set_id).toBe(draftSetId(META));
        expect(set.set_id).toBe("created-my-french-basics");
        expect(set.target_language).toBe("fr");
        expect(set.source_language).toBe("de");
        expect(set.title_native).toBe("Bases du français");
        expect(set.origin).toBe("imported");
        expect(set.lessons).toHaveLength(1);
    });

    it("checkDraft passes a complete draft", () => {
        const checks = checkDraft(input());
        expect(allChecksPass(checks)).toBe(true);
    });

    it("checkDraft fails on too few cards / exercises", () => {
        const bad = checkDraft(input(3));
        expect(bad.enoughCards).toBe(false);
        expect(allChecksPass(bad)).toBe(false);
    });

    it("checkDraft fails on an empty title", () => {
        const i = input();
        const checks = checkDraft({
            ...i,
            meta: {...META, title: ""},
        });
        expect(checks.hasTitle).toBe(false);
        expect(allChecksPass(checks)).toBe(false);
    });

    it("checkDraft passes a same-language pair (#1715, knowledge domains)", () => {
        // ki-einsteiger-style de -> de knowledge content is legitimate:
        // an identical source/target pair is no longer a save gate.
        const i = input();
        const checks = checkDraft({
            ...i,
            meta: {...META, sourceLanguage: "de", targetLanguage: "de"},
        });
        expect(allChecksPass(checks)).toBe(true);
    });
});
