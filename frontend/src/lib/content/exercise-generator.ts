/**
 * Shared exercise generator (Phase 65C / EXP-021).
 *
 * One generator, two entry points: the chat-analysis path
 * (``analysis-to-lesson.ts``) and the standalone Lesson Creator both
 * turn a list of cards into ``ContentLessonExercise`` objects through
 * the builders here. Deterministic, offline, no AI.
 *
 * Cards are normalised to ``GeneratorCard`` (id + front/back + an
 * optional example sentence for cloze/word-tiles + an optional image
 * for picture-choice). Each per-type builder mirrors the original
 * analysis-to-lesson logic exactly so the analysis output is
 * unchanged; ``generateExercises`` adds the creator's config layer
 * (type mix + count cap + drill direction).
 */

import type {
    ContentExerciseDirection,
    ContentLessonExercise,
} from "../../storage/types";

export type GeneratableType =
    | "matching"
    | "free_text"
    | "cloze"
    | "word_tiles"
    | "picture_choice";

export interface GeneratorCard {
    /** Card id referenced from the exercise's ``card_ids``. */
    id: string;
    /** Target-language word/phrase (raw; builders trim). */
    front: string;
    /** Source-language translation (raw; builders trim). */
    back: string;
    /** Optional example sentence — enables cloze + word-tiles. */
    example?: string | null;
    /** Optional image reference — enables picture-choice. */
    image?: string | null;
}

export interface ExercisePrompts {
    matching: string;
    freeText: string;
    cloze: string;
    wordTiles: string;
    pictureChoice: string;
}

export const DEFAULT_EXERCISE_PROMPTS: ExercisePrompts = {
    matching: "Match each word with its translation.",
    freeText: "Translate: {word}",
    cloze: "Fill in the missing word.",
    wordTiles: "Arrange the words into the sentence ({word}).",
    pictureChoice: "Pick the image for: {word}",
};

export type ExerciseDirectionStrategy =
    | "auto"
    | "receptive"
    | "productive"
    | "balanced";

export interface ExerciseGenConfig {
    /** Target number of exercises (the cap on the selection). */
    count: number;
    /** Which exercise types to include. */
    types: GeneratableType[];
    /** Drill direction strategy (EXP-018). */
    direction: ExerciseDirectionStrategy;
    /** Cards per matching group. */
    matchingGroupSize?: number;
}

export const DEFAULT_EXERCISE_GEN_CONFIG: ExerciseGenConfig = {
    count: 10,
    types: ["matching", "free_text", "cloze", "word_tiles", "picture_choice"],
    direction: "auto",
    matchingGroupSize: 5,
};

// --- helpers (kept local so the module is self-contained) ----------

function clampLen(text: string, max: number): string {
    return text.length <= max ? text : text.slice(0, max);
}

function uniq<T>(items: T[]): T[] {
    return Array.from(new Set(items));
}

function acceptVariants(translation: string): string[] {
    const trimmed = translation.trim();
    return uniq([trimmed, trimmed.toLowerCase()]).filter(Boolean);
}

/** Blank the first whole-string occurrence of ``word`` in
 *  ``example`` with a single ``___`` marker. null when absent or
 *  ambiguous (the cloze schema needs exactly one marker per blank). */
export function blankExample(example: string, word: string): string | null {
    const trimmed = example.trim();
    const target = word.trim();
    if (!trimmed || !target) return null;
    const first = trimmed.indexOf(target);
    if (first === -1) return null;
    if (trimmed.indexOf(target, first + target.length) !== -1) return null;
    return (
        trimmed.slice(0, first) + "___" + trimmed.slice(first + target.length)
    );
}

// --- per-type builders ---------------------------------------------

export function buildMatching(
    cards: GeneratorCard[],
    groupSize: number,
    prompt: string,
): ContentLessonExercise[] {
    const out: ContentLessonExercise[] = [];
    for (let start = 0; start < cards.length; start += groupSize) {
        const slice = cards.slice(start, start + groupSize);
        if (slice.length < 2) break; // a 1-pair matching is degenerate
        const groupIndex = out.length;
        out.push({
            id: `ex-match-${groupIndex}`,
            type: "matching",
            prompt: clampLen(prompt, 1000),
            card_ids: slice.map((c) => c.id),
            pairs: slice.map((c) => ({
                left: c.front.trim(),
                right: c.back.trim(),
            })),
            distractors: [],
        });
    }
    return out;
}

export function buildFreeText(
    cards: GeneratorCard[],
    promptTemplate: string,
): ContentLessonExercise[] {
    return cards.map((c, i) => ({
        id: `ex-free-${i}`,
        type: "free_text",
        prompt: clampLen(promptTemplate.replace("{word}", c.front.trim()), 1000),
        card_ids: [c.id],
        accept: acceptVariants(c.back),
        distractors: [],
    }));
}

export function buildCloze(
    cards: GeneratorCard[],
    prompt: string,
): ContentLessonExercise[] {
    const out: ContentLessonExercise[] = [];
    cards.forEach((c, i) => {
        if (!c.example) return;
        const sentence = blankExample(c.example, c.front);
        if (!sentence) return;
        out.push({
            id: `ex-cloze-${i}`,
            type: "cloze",
            prompt,
            card_ids: [c.id],
            sentence,
            blanks: [{accept: acceptVariants(c.front)}],
            cloze_mode: "type",
            distractors: [],
        });
    });
    return out;
}

export function buildWordTiles(
    cards: GeneratorCard[],
    promptTemplate: string,
): ContentLessonExercise[] {
    const out: ContentLessonExercise[] = [];
    cards.forEach((c, i) => {
        if (!c.example) return;
        const tiles = c.example.trim().split(/\s+/).filter(Boolean);
        if (tiles.length < 2) return;
        out.push({
            id: `ex-tiles-${i}`,
            type: "word_tiles",
            prompt: clampLen(
                promptTemplate.replace("{word}", c.front.trim()),
                1000,
            ),
            card_ids: [c.id],
            tiles,
            distractors: [],
        });
    });
    return out;
}

/** Picture-choice (creator-only): one exercise per card that has an
 *  image; the other image-bearing cards supply the distractor tiles
 *  (up to 3). Needs >= 2 images total to be non-degenerate. */
export function buildPictureChoice(
    cards: GeneratorCard[],
    prompt: string,
): ContentLessonExercise[] {
    const withImg = cards.filter((c) => (c.image ?? "").trim().length > 0);
    if (withImg.length < 2) return [];
    const out: ContentLessonExercise[] = [];
    withImg.forEach((c, i) => {
        const others = withImg.filter((o) => o.id !== c.id).slice(0, 3);
        const images = [c, ...others].map((opt) => ({
            src: (opt.image ?? "").trim(),
            label: opt.front.trim(),
            is_correct: opt.id === c.id ? "true" : undefined,
        }));
        out.push({
            id: `ex-pic-${i}`,
            type: "picture_choice",
            prompt: clampLen(prompt.replace("{word}", c.front.trim()), 1000),
            card_ids: [c.id],
            images,
            distractors: [],
        });
    });
    return out;
}

const TYPE_RANK: Record<string, number> = {
    matching: 0,
    free_text: 1,
    cloze: 2,
    word_tiles: 3,
    picture_choice: 4,
};

/** Round-robin across buckets (preserves type variety under the cap),
 *  then order easy -> hard for a difficulty progression. */
export function selectExercises(
    buckets: ContentLessonExercise[][],
    max: number,
): ContentLessonExercise[] {
    const selected: ContentLessonExercise[] = [];
    let drained = false;
    let round = 0;
    while (selected.length < max && !drained) {
        drained = true;
        for (const bucket of buckets) {
            if (selected.length >= max) break;
            if (round < bucket.length) {
                selected.push(bucket[round]);
                drained = false;
            }
        }
        round += 1;
    }
    return selected.sort(
        (a, b) =>
            (TYPE_RANK[a.type] ?? 9) - (TYPE_RANK[b.type] ?? 9) ||
            (a.id < b.id ? -1 : 1),
    );
}

function directionFor(
    strategy: ExerciseDirectionStrategy,
    index: number,
): ContentExerciseDirection | undefined {
    switch (strategy) {
        case "receptive":
            return "target_to_source";
        case "productive":
            return "source_to_target";
        case "balanced":
            return index % 2 === 0 ? "target_to_source" : "source_to_target";
        case "auto":
        default:
            return undefined; // defaults to receptive downstream
    }
}

export interface GenerateExercisesOpts {
    prompts?: Partial<ExercisePrompts>;
}

/** Creator entry point: build a config-driven mix of exercises from
 *  the cards. Re-ids the final selection sequentially so ids are
 *  stable + unique regardless of which builders contributed. */
export function generateExercises(
    cards: GeneratorCard[],
    config: ExerciseGenConfig = DEFAULT_EXERCISE_GEN_CONFIG,
    opts: GenerateExercisesOpts = {},
): ContentLessonExercise[] {
    const prompts = {...DEFAULT_EXERCISE_PROMPTS, ...(opts.prompts ?? {})};
    const groupSize = config.matchingGroupSize ?? 5;
    const enabled = new Set(config.types);
    const buckets: ContentLessonExercise[][] = [];
    if (enabled.has("matching"))
        buckets.push(buildMatching(cards, groupSize, prompts.matching));
    if (enabled.has("free_text"))
        buckets.push(buildFreeText(cards, prompts.freeText));
    if (enabled.has("cloze")) buckets.push(buildCloze(cards, prompts.cloze));
    if (enabled.has("word_tiles"))
        buckets.push(buildWordTiles(cards, prompts.wordTiles));
    if (enabled.has("picture_choice"))
        buckets.push(buildPictureChoice(cards, prompts.pictureChoice));

    const selected = selectExercises(buckets, Math.max(1, config.count));
    return selected.map((ex, i) => ({
        ...ex,
        // Slug-safe id (the lesson schema requires ``[a-z0-9-]`` step
        // + exercise ids), so the type's underscore becomes a hyphen.
        id: `ex-${i + 1}-${ex.type.replace(/_/g, "-")}`,
        direction: directionFor(config.direction, i) ?? ex.direction ?? null,
    }));
}
