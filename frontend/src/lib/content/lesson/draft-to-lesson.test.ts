import {describe, expect, it, vi} from "vitest";

import {generateExercises} from "../../exercises";
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
    domain: "language",
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

    // #1929 — the "language pair is valid" check is rendered again. Its
    // meaning is "both sides are SUPPORTED language codes", NOT the removed
    // "source !== target" gate (which wrongly rejected knowledge-domain
    // lessons). A same-language pair therefore still passes.
    it("checkDraft marks a supported language pair valid (#1929)", () => {
        const checks = checkDraft(input());
        expect(checks.languagePair).toBe(true);
    });

    it("checkDraft keeps a same-language pair a VALID pair (#1929)", () => {
        const i = input();
        const checks = checkDraft({
            ...i,
            meta: {...META, sourceLanguage: "de", targetLanguage: "de"},
        });
        // The reactivated check must NOT reintroduce the source !== target
        // gate — de -> de is a valid, supported pair.
        expect(checks.languagePair).toBe(true);
        expect(allChecksPass(checks)).toBe(true);
    });

    it("checkDraft fails languagePair on an unsupported language code (#1929)", () => {
        const i = input();
        const checks = checkDraft({
            ...i,
            meta: {...META, targetLanguage: "zz"},
        });
        expect(checks.languagePair).toBe(false);
        expect(allChecksPass(checks)).toBe(false);
    });

    it("checkDraft fails languagePair on an empty language code (#1929)", () => {
        const i = input();
        const checks = checkDraft({
            ...i,
            meta: {...META, sourceLanguage: ""},
        });
        expect(checks.languagePair).toBe(false);
        expect(allChecksPass(checks)).toBe(false);
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
        // #2384 — a real content violation is NOT an internal error, and the
        // internal ``generated lesson invalid:`` prefix is stripped so the
        // detail reads as the plain, actionable reason.
        expect(checks.schemaErrorIsInternal).toBe(false);
        expect(checks.schemaError).not.toContain("generated lesson invalid:");
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
        // #2384 — a valid draft is never flagged as an internal error.
        expect(checks.schemaErrorIsInternal).toBe(false);
        // The extra detail field must not break the boolean aggregate.
        expect(allChecksPass(checks)).toBe(true);
    });
});

// #1895 — a dictation (extension) exercise can now reach the MAIN wizard path
// via the core-type picker. Whatever the build path, the resulting lesson must
// declare ``requires_extensions`` so it is refused (not mis-rendered) in an app
// without the extension. This is the safety generalization the Verify-First
// step surfaced: only ``buildExtensionLesson`` used to set the field.
describe("draft-to-lesson requires_extensions generalization (#1895)", () => {
    const dictationExercise = {
        id: "ex-dict-manual",
        type: "ext:al-dictation",
        prompt: "Hoere zu und schreibe, was du hoerst.",
        card_ids: [],
        distractors: [],
        ext_payload: {audio: "assets/audio/clip.mp3", accept: ["Bonjour"]},
    };

    function draftWithDictation(): DraftLessonInput {
        const base = input();
        return {
            ...base,
            exercises: [
                ...base.exercises,
                dictationExercise as unknown as (typeof base.exercises)[number],
            ],
        };
    }

    it("declares the extension when the draft contains a dictation exercise", () => {
        const lesson = buildLessonFromDraft(draftWithDictation());
        expect(lesson.requires_extensions).toContain("ext:al-dictation@1");
    });

    it("does NOT add requires_extensions for a pure core draft", () => {
        const lesson = buildLessonFromDraft(input());
        // Absent or empty — never a spurious [] on every core lesson.
        expect(lesson.requires_extensions ?? []).toEqual([]);
    });

    it("the built dictation lesson passes the load guard", () => {
        // buildLessonFromDraft validates internally; a throw here would mean
        // the undeclared-extension guard fired -> the field was NOT set.
        expect(() => buildLessonFromDraft(draftWithDictation())).not.toThrow();
    });

    it("edit-mode (id + preserved theory) also declares the extension", () => {
        const lesson = buildLessonFromDraft(draftWithDictation(), {
            id: "kept-id",
            theorySteps: [
                {id: "theory-intro", type: "theory", title: "T", body: "Body"},
            ],
        });
        expect(lesson.id).toBe("kept-id");
        expect(lesson.requires_extensions).toContain("ext:al-dictation@1");
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

// #1919 — reopening a saved core-only lesson for editing fails the structural
// check with "/steps/1/exercise/ext_payload must be object". In API mode the
// GET lessons endpoint serves the lesson via ``response_model=Lesson`` with the
// default ``exclude_none=False``, so the Pydantic ``Exercise.ext_payload:
// dict | None = None`` is emitted as ``ext_payload: null`` on every CORE
// exercise. The ajv schema types ext_payload as object-only (no null branch;
// "Absent on core exercises"), while every other optional field tolerates null
// via ``anyOf: [..., {type: null}]`` — so only ext_payload breaks. (Dexie mode
// parses via the engine adapter, which omits the key, so it reproduces only in
// API mode.) Reconstruction must drop ext_payload from core exercises and keep
// it for real extension exercises.
describe("draft-to-lesson edit-mode ext_payload reconstruction (#1919)", () => {
    /** A saved lesson as it comes back from the API-mode GET: the Pydantic
     *  ``exclude_none=False`` serialization has materialized ``ext_payload:
     *  null`` on every core exercise. */
    function reloadedCoreLesson() {
        const built = buildLessonFromDraft(input());
        return {
            ...built,
            steps: built.steps.map((s) =>
                s.type === "exercise" && s.exercise
                    ? {
                          ...s,
                          exercise: {
                              ...s.exercise,
                              ext_payload: null,
                          } as unknown as (typeof s)["exercise"],
                      }
                    : s,
            ),
        };
    }

    it("strips ext_payload from reconstructed core exercises", () => {
        const back = lessonToDraftInput(reloadedCoreLesson(), {level: "A1"});
        expect(back.exercises.length).toBeGreaterThan(0);
        expect(back.exercises.every((e) => !("ext_payload" in e))).toBe(true);
    });

    it("re-building a reopened core lesson validates (no ext_payload error)", () => {
        const reloaded = reloadedCoreLesson();
        const back = lessonToDraftInput(reloaded, {level: "A1"});
        // Before the fix this threw "/steps/1/exercise/ext_payload must be object".
        expect(() =>
            buildLessonFromDraft(back, {
                id: reloaded.id,
                theorySteps: preservedTheorySteps(reloaded.steps, back.meta),
            }),
        ).not.toThrow();
    });

    it("preserves ext_payload for a real extension exercise (no over-correction)", () => {
        const dictation = {
            id: "ex-dict",
            type: "ext:al-dictation",
            prompt: "Hoere zu und schreibe, was du hoerst.",
            card_ids: [],
            distractors: [],
            ext_payload: {audio: "assets/audio/clip.mp3", accept: ["Bonjour"]},
        };
        const base = input();
        const built = buildLessonFromDraft({
            ...base,
            exercises: [
                ...base.exercises,
                dictation as unknown as (typeof base.exercises)[number],
            ],
        });
        // Simulate the reload: core exercises gain ext_payload: null, the
        // extension exercise keeps its real payload object.
        const reloaded = {
            ...built,
            steps: built.steps.map((s) =>
                s.type === "exercise" &&
                s.exercise &&
                s.exercise.type !== "ext:al-dictation"
                    ? {
                          ...s,
                          exercise: {
                              ...s.exercise,
                              ext_payload: null,
                          } as unknown as (typeof s)["exercise"],
                      }
                    : s,
            ),
        };
        const back = lessonToDraftInput(reloaded, {level: "A1"});
        const rebuiltDictation = back.exercises.find(
            (e) => e.type === "ext:al-dictation",
        );
        expect(rebuiltDictation?.ext_payload).toEqual({
            audio: "assets/audio/clip.mp3",
            accept: ["Bonjour"],
        });
        // Core exercises are still stripped even alongside an extension one.
        expect(
            back.exercises
                .filter((e) => e.type !== "ext:al-dictation")
                .every((e) => !("ext_payload" in e)),
        ).toBe(true);
    });
});

// #1716 — the CreateLesson wizard can now author an explicit content domain.
// A known NON-language domain is stamped onto the built lesson (schema v1.3);
// the default language domain leaves the field absent. Round-trips back on edit.
describe("draft-to-lesson content domain (#1716)", () => {
    it("stamps a known non-language domain onto the built lesson", () => {
        const lesson = buildLessonFromDraft({
            ...input(),
            meta: {...META, domain: "psychology"},
        });
        expect(lesson.domain).toBe("psychology");
    });

    it("leaves no domain field for the default language domain", () => {
        const lesson = buildLessonFromDraft(input());
        expect(lesson.domain).toBeUndefined();
    });

    it("does NOT stamp an unknown domain value", () => {
        const lesson = buildLessonFromDraft({
            ...input(),
            meta: {...META, domain: "not-a-real-domain"},
        });
        expect(lesson.domain).toBeUndefined();
    });

    it("lowercases the stamped domain", () => {
        const lesson = buildLessonFromDraft({
            ...input(),
            meta: {...META, domain: "Programming"},
        });
        expect(lesson.domain).toBe("programming");
    });

    it("round-trips a stamped domain back into the wizard draft on edit", () => {
        const built = buildLessonFromDraft({
            ...input(),
            meta: {...META, domain: "knowledge"},
        });
        const back = lessonToDraftInput(built, {level: ""});
        expect(back.meta.domain).toBe("knowledge");
    });

    it("normalises a missing/unknown lesson domain back to language on edit", () => {
        const built = buildLessonFromDraft(input());
        const back = lessonToDraftInput(built, {level: "A1"});
        expect(back.meta.domain).toBe("language");
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

describe("checkDraft empty-state console silence (#2205 station)", () => {
    it("does not console.error for the pristine empty draft", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            checkDraft({
                meta: {
                    title: "",
                    titleNative: "",
                    sourceLanguage: "de",
                    targetLanguage: "fr",
                    level: "A1",
                    description: "",
                    author: "",
                    domain: "language",
                },
                cards: [],
                exercises: [],
            });
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });

    it("still console.errors when a non-empty draft is structurally invalid", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            const bad = input(5);
            bad.meta = {...bad.meta, title: ""};
            checkDraft(bad);
            expect(spy).toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });
});
