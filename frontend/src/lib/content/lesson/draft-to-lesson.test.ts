import {describe, expect, it} from "vitest";

import {generateExercises} from "./exercise/exercise-generator";
import {
    allChecksPass,
    buildLessonFromDraft,
    buildUserSetInput,
    checkDraft,
    draftCardsToGeneratorCards,
    draftSetId,
    lessonToDraftInput,
    preservedTheorySteps,
    type DraftLessonInput,
} from "./draft-to-lesson";
import type {LessonCardDraft, LessonMeta} from "./lesson-draft";
import type {ContentLessonStep} from "../../../storage/types";

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

    // #1722 — the reproduction: all COUNT checks pass, only the structural
    // validator fails (an empty card side, reachable through the unguarded
    // inline card edit), and the validator's reason must survive into the
    // checklist instead of being swallowed to a bare boolean.
    it("checkDraft surfaces the validator message for an empty card side (#1722)", () => {
        const i = input();
        i.cards[0] = {...i.cards[0], back: ""};
        const checks = checkDraft(i);
        expect(checks.enoughCards).toBe(true);
        expect(checks.enoughExercises).toBe(true);
        expect(checks.enoughTypes).toBe(true);
        expect(checks.schemaValid).toBe(false);
        expect(allChecksPass(checks)).toBe(false);
        // The precise ajv reason is carried, not discarded.
        expect(checks.schemaError).toBeTruthy();
        expect(checks.schemaError).toContain("/cards/0");
    });

    it("checkDraft surfaces the validator message for an over-long card side (#1722)", () => {
        const i = input();
        i.cards[1] = {...i.cards[1], back: "x".repeat(501)};
        const checks = checkDraft(i);
        expect(checks.schemaValid).toBe(false);
        expect(checks.schemaError).toContain("/cards/1");
    });

    it("a passing draft carries no schemaError (#1722)", () => {
        const checks = checkDraft(input());
        expect(checks.schemaValid).toBe(true);
        expect(checks.schemaError).toBeNull();
        // The extra detail field must not break the boolean aggregate.
        expect(allChecksPass(checks)).toBe(true);
    });
});

// #1740 — lesson editing: reverse mapping, id/set-id override, theory
// preservation.
describe("draft-to-lesson editing (#1740)", () => {
    it("round-trips a built lesson back into the wizard draft", () => {
        const built = buildLessonFromDraft(input());
        const back = lessonToDraftInput(built, {level: "A1", title_native: null});
        expect(back.meta.title).toBe("My French Basics");
        expect(back.meta.sourceLanguage).toBe("de");
        expect(back.meta.targetLanguage).toBe("fr");
        expect(back.meta.level).toBe("A1");
        expect(back.meta.author).toBe("Aster");
        expect(back.cards).toHaveLength(built.cards.length);
        expect(back.cards[0].front).toBe(built.cards[0].front);
        // Exercises come straight off the exercise steps (theory dropped).
        const exSteps = built.steps.filter((s) => s.type === "exercise");
        expect(back.exercises).toHaveLength(exSteps.length);
        expect(back.exercises[0].id).toBe(exSteps[0].exercise?.id);
    });

    it("re-build after a reverse map keeps a stable, overwriteable shape", () => {
        const built = buildLessonFromDraft(input());
        const back = lessonToDraftInput(built, {level: "A1"});
        const rebuilt = buildLessonFromDraft(back, {
            id: built.id,
            theorySteps: preservedTheorySteps(built.steps, back.meta),
        });
        expect(rebuilt.id).toBe(built.id);
        expect(rebuilt.steps.filter((s) => s.type === "exercise")).toHaveLength(
            built.steps.filter((s) => s.type === "exercise").length,
        );
        // The wizard intro is regenerated (wizard lineage), title reflected.
        expect(rebuilt.steps[0].type).toBe("theory");
        expect(rebuilt.steps[0].id).toBe("theory-intro");
    });

    it("opts.id overrides the derived lesson filename (preserves progress)", () => {
        const lesson = buildLessonFromDraft(input(), {id: "colors"});
        expect(lesson.id).toBe("colors");
        // A title change would normally re-slug the id; the override wins.
        const renamed = buildLessonFromDraft(
            {...input(), meta: {...META, title: "Farben komplett neu"}},
            {id: "colors"},
        );
        expect(renamed.id).toBe("colors");
    });

    it("regenerates the intro from the title for wizard-created lineage", () => {
        const original = buildLessonFromDraft(input()); // has theory-intro
        const renamedMeta: LessonMeta = {...META, title: "Renamed Lesson"};
        const theory = preservedTheorySteps(original.steps, renamedMeta);
        expect(theory).toHaveLength(1);
        expect(theory[0].id).toBe("theory-intro");
        expect(theory[0].body).toContain("# Renamed Lesson");
    });

    it("preserves authored theory verbatim for imported lineage", () => {
        // An imported lesson: real theory steps, none named theory-intro.
        const importedSteps: ContentLessonStep[] = [
            {id: "t1", type: "theory", title: "Grammar", body: "# Grammar\n\nRich text."},
            {id: "t2", type: "theory", title: "Notes", body: "More authored theory."},
            {id: "e1", type: "exercise", title: null, body: null, exercise: null},
        ];
        const theory = preservedTheorySteps(importedSteps, {...META, title: "Whatever"});
        expect(theory).toHaveLength(2);
        expect(theory.map((s) => s.id)).toEqual(["t1", "t2"]);
        // No synthetic intro was injected (no data the wizard can't hold).
        expect(theory.some((s) => s.id === "theory-intro")).toBe(false);
        expect(theory[0].body).toContain("Rich text.");
    });

    it("buildUserSetInput overrides the set id and origin in edit mode", () => {
        const i = input();
        const set = buildUserSetInput(i, buildLessonFromDraft(i), {
            setId: "created-original-id",
            origin: "adaptive",
        });
        expect(set.set_id).toBe("created-original-id");
        expect(set.origin).toBe("adaptive");
    });

    it("a preserved-theory edit (typo fix on a card) still builds a valid lesson", () => {
        const original = buildLessonFromDraft(input());
        const back = lessonToDraftInput(original, {level: "A1"});
        // Fix a typo on a card back — the exercises still reference every
        // card, so the rebuild under the original id must validate. (The
        // card's content-derived SRS key changes; that self-orphaning is
        // the intended behaviour, verified end-to-end elsewhere.)
        back.cards[0] = {...back.cards[0], back: "corrected"};
        const rebuilt = buildLessonFromDraft(back, {
            id: original.id,
            theorySteps: preservedTheorySteps(original.steps, back.meta),
        });
        expect(rebuilt.id).toBe(original.id);
        expect(rebuilt.cards[0].back).toBe("corrected");
    });
});

describe("draftCardsToGeneratorCards (#1847)", () => {
    function draftCard(over: Partial<LessonCardDraft>): LessonCardDraft {
        return {
            id: "c1",
            front: "lis",
            back: "read",
            notes: "a teaching note",
            image: "",
            example: "",
            ...over,
        };
    }

    it("feeds the generator's example from the card's example field, NOT notes", () => {
        const [gc] = draftCardsToGeneratorCards([
            draftCard({notes: "note only", example: "Je lis un livre."}),
        ]);
        expect(gc.example).toBe("Je lis un livre.");
    });

    it("passes image + altAnswers through and defaults a missing example to empty", () => {
        const [gc] = draftCardsToGeneratorCards([
            {
                id: "c2",
                front: "chat",
                back: "cat",
                notes: "",
                image: "data:image/png;base64,AAA",
                altAnswers: ["kitty"],
            },
        ]);
        expect(gc.image).toBe("data:image/png;base64,AAA");
        expect(gc.altAnswers).toEqual(["kitty"]);
        expect(gc.example).toBe("");
    });

    it("makes example-bearing cards drive cloze generation end to end", () => {
        const cards = draftCardsToGeneratorCards([
            draftCard({id: "c1", front: "lis", example: "Je lis un livre."}),
            draftCard({id: "c2", front: "mange", example: "Tu manges une pomme."}),
        ]);
        const exercises = generateExercises(cards, {
            count: 10,
            types: ["cloze"],
            direction: "auto",
        });
        expect(exercises.length).toBeGreaterThan(0);
        expect(exercises.every((e) => e.type === "cloze")).toBe(true);
    });
});
