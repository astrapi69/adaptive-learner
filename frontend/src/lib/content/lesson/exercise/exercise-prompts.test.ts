/**
 * #1855 — the Create-Lesson wizard burned the English
 * ``DEFAULT_EXERCISE_PROMPTS`` into generated lessons regardless of the
 * UI language. These pins drive {@link localizedExercisePrompts} with a
 * ``t`` backed by the REAL bundled catalogs (de + en), so the templates
 * the generator receives are exactly what a de-locale / en-locale user
 * gets in production — no hand-built fixture drift.
 *
 * The ``{word}`` placeholder is the foreign-language learning content
 * itself and MUST stay untranslated; only the surrounding instruction
 * localizes.
 */

import {readFileSync} from "node:fs";
import {join} from "node:path";

import {describe, expect, it} from "vitest";

import {
    DEFAULT_EXERCISE_PROMPTS,
    generateExercises,
    type GeneratorCard,
} from "./exercise-generator";
import {localizedExercisePrompts} from "./exercise-prompts";

const I18N_DIR = join(__dirname, "../../../../data/i18n");

type Catalog = Record<string, unknown>;

function loadCatalog(lang: string): Catalog {
    return JSON.parse(readFileSync(join(I18N_DIR, `${lang}.json`), "utf-8"));
}

/** Dotted-path resolver mirroring the production ``t`` walk. */
function makeT(catalog: Catalog) {
    return (key: string, fallback?: string): string => {
        let cursor: unknown = catalog;
        for (const part of key.split(".")) {
            if (
                cursor &&
                typeof cursor === "object" &&
                part in (cursor as Record<string, unknown>)
            ) {
                cursor = (cursor as Record<string, unknown>)[part];
            } else {
                return fallback ?? key;
            }
        }
        return typeof cursor === "string" ? cursor : (fallback ?? key);
    };
}

const CARDS: GeneratorCard[] = [
    {id: "c1", front: "Bonjour", back: "Hallo", example: "Bonjour tout le monde"},
    {id: "c2", front: "Salut", back: "Hi", example: "Salut mon ami"},
    {id: "c3", front: "Bonsoir", back: "Guten Abend", example: "Bonsoir madame"},
    {id: "c4", front: "Merci", back: "Danke", example: "Merci beaucoup"},
];

describe("localizedExercisePrompts (#1855)", () => {
    it("resolves every template from the de catalog (no English fallback)", () => {
        const prompts = localizedExercisePrompts(makeT(loadCatalog("de")));
        expect(prompts.matching).toBe("Ordne jedes Wort seiner Übersetzung zu.");
        expect(prompts.freeText).toBe("Übersetze: {word}");
        expect(prompts.cloze).toBe("Fülle das fehlende Wort ein.");
        expect(prompts.wordTiles).toBe(
            "Bringe die Wörter in die richtige Reihenfolge ({word}).",
        );
        // pic_prompt is the one template that had no catalog key at all —
        // without it the picture-choice prompt stays English in every
        // language.
        expect(prompts.pictureChoice).not.toBe(
            DEFAULT_EXERCISE_PROMPTS.pictureChoice,
        );
        expect(prompts.pictureChoice).toContain("{word}");
    });

    it("keeps the English wording under the en catalog (no regression)", () => {
        const prompts = localizedExercisePrompts(makeT(loadCatalog("en")));
        expect(prompts.matching).toBe(DEFAULT_EXERCISE_PROMPTS.matching);
        expect(prompts.freeText).toBe(DEFAULT_EXERCISE_PROMPTS.freeText);
        expect(prompts.cloze).toBe(DEFAULT_EXERCISE_PROMPTS.cloze);
        expect(prompts.wordTiles).toBe(DEFAULT_EXERCISE_PROMPTS.wordTiles);
    });

    it("resolves the picture-choice template in every catalog", () => {
        for (const lang of [
            "de",
            "el",
            "en",
            "es",
            "fr",
            "hi",
            "id",
            "ja",
            "ko",
            "pt",
            "tr",
        ]) {
            const t = makeT(loadCatalog(lang));
            // No fallback passed: a missing key echoes the key itself,
            // which is how a not-yet-authored catalog entry shows up.
            const raw = t("content.lesson_gen.pic_prompt");
            expect(
                raw,
                `${lang}: content.lesson_gen.pic_prompt missing — English ` +
                    `fallback would burn into generated lessons`,
            ).not.toBe("content.lesson_gen.pic_prompt");
            const prompts = localizedExercisePrompts(t);
            if (lang !== "en") {
                expect(prompts.pictureChoice).not.toBe(
                    DEFAULT_EXERCISE_PROMPTS.pictureChoice,
                );
            }
            expect(prompts.pictureChoice).toContain("{word}");
        }
    });
});

describe("generateExercises with de-locale prompts (#1855)", () => {
    const dePrompts = localizedExercisePrompts(makeT(loadCatalog("de")));
    const generated = generateExercises(
        CARDS,
        {
            count: 12,
            types: ["matching", "free_text", "word_tiles"],
            direction: "auto",
        },
        {prompts: dePrompts},
    );

    it("emits a German matching instruction", () => {
        const matching = generated.filter((ex) => ex.type === "matching");
        expect(matching.length).toBeGreaterThan(0);
        for (const ex of matching) {
            expect(ex.prompt).toBe("Ordne jedes Wort seiner Übersetzung zu.");
        }
    });

    it("emits German free-text instructions with the untranslated card front", () => {
        const freeText = generated.filter((ex) => ex.type === "free_text");
        expect(freeText.length).toBeGreaterThan(0);
        const prompts = freeText.map((ex) => ex.prompt);
        expect(prompts).toContain("Übersetze: Bonjour");
        for (const prompt of prompts) {
            expect(prompt).toMatch(/^Übersetze: /);
            expect(prompt).not.toContain("Translate");
            expect(prompt).not.toContain("{word}");
        }
    });

    it("emits German word-tiles instructions with the untranslated card front", () => {
        const tiles = generated.filter((ex) => ex.type === "word_tiles");
        expect(tiles.length).toBeGreaterThan(0);
        const prompts = tiles.map((ex) => ex.prompt);
        expect(prompts).toContain(
            "Bringe die Wörter in die richtige Reihenfolge (Bonjour).",
        );
        for (const prompt of prompts) {
            expect(prompt).not.toContain("Arrange the words");
        }
    });
});
