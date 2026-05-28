/**
 * Rule-based adaptive lesson generator (Phase 53C / v1.36.0 /
 * EXP-013 / P-137, P-138).
 *
 * Takes the analyzer's output + an exercise pool + a config
 * and emits a synthetic ``ContentLesson`` the existing
 * LessonViewer renders unmodified. Deterministic + offline —
 * no AI calls, no Math.random, no network. The viewer treats
 * the generated lesson identically to a cached lesson; the
 * caller embeds the generation parameters in the lesson id
 * (``adaptive-{set_id}-{ISO timestamp}``) so progress
 * tracking can disambiguate generations.
 *
 * Algorithm (53C):
 *
 *   1. Group candidates by ``element_key``.
 *   2. Walk ``analysis.prioritized_elements`` in priority
 *      order. For each element, pick the candidate that best
 *      satisfies the type-mix target (largest deficit wins;
 *      ties broken by lower difficulty then by exercise id
 *      for cross-runtime parity).
 *   3. Cycle through the priority list multiple times to
 *      reach ``max_exercises``, never selecting the same
 *      (element_key, exercise.id) twice. Variation across
 *      iterations is what gives 53D its hook in.
 *   4. Sort the chosen exercises per ``difficulty_curve``.
 *   5. Prepend a theory step extracted from the dominant
 *      cluster's source lessons when available. The theory
 *      content is REUSED verbatim from the authored lesson —
 *      never generated.
 *   6. Wrap the steps into a ContentLesson and emit.
 *
 * When the pool is empty (no candidates target any
 * prioritized element), the function returns a ContentLesson
 * with zero steps. The caller is responsible for surfacing a
 * friendly "no adaptive content yet" message instead of
 * rendering the empty lesson.
 */

import type {
    ContentLesson,
    ContentLessonStep,
    ElementError,
} from "../../storage/types";

import type {ExerciseCandidate} from "./exercise-pool";
import type {ErrorAnalysis, PrioritizedElement} from "./types";

export type DifficultyCurve = "ascending" | "descending" | "mixed";

export interface ExerciseTypeMix {
    matching: number;
    picture_choice: number;
    free_text: number;
    word_tiles: number;
    cloze: number;
}

export interface GeneratorConfig {
    /** Cap on emitted exercise steps. Default 10. */
    max_exercises: number;
    /** Target proportions per type (sums to ~1.0). The
     *  generator picks the candidate whose type is currently
     *  most below its target when there's a choice. */
    exercise_type_mix: ExerciseTypeMix;
    /** Order of the final step list. */
    difficulty_curve: DifficultyCurve;
    /** 0..1. Higher = more aggressive variation (53D will
     *  use this; 53C reads it for cycle policy only — at
     *  variation_factor 0, every iteration picks the same
     *  candidate per element; at 1, it always rotates). */
    variation_factor: number;
}

export const DEFAULT_GENERATOR_CONFIG: GeneratorConfig = {
    max_exercises: 10,
    exercise_type_mix: {
        matching: 0.2,
        picture_choice: 0.1,
        free_text: 0.3,
        word_tiles: 0.2,
        cloze: 0.2,
    },
    difficulty_curve: "ascending",
    variation_factor: 0.7,
};

export interface GenerateOpts {
    /** All cached lessons. Needed for theory-step reuse and
     *  for the lesson generator's source lookup. */
    lessons: ReadonlyMap<string, ContentLesson>;
    /** Title for the synthesised lesson — caller passes an
     *  already-localised string (this module is i18n-naive,
     *  same as ``synthesizeReviewLesson``). */
    title: string;
    /** Optional description shown beneath the title. */
    description?: string;
    /** Set id the generation belongs to. Embedded in the
     *  lesson id for cache disambiguation. */
    set_id: string;
    /** Generator config overrides. Anything not specified
     *  falls back to ``DEFAULT_GENERATOR_CONFIG``. */
    config?: Partial<GeneratorConfig>;
    /** ISO-8601 string. Embedded in the lesson id for
     *  uniqueness. Pass a pinned value in tests to keep
     *  output deterministic. */
    now: string;
    /** Per-element source ``ElementError`` rows. When supplied
     *  the variation logic (Phase 53D / P-138) consults the
     *  source error to:
     *    1. Filter out literal-replay candidates whose
     *       ``(source_lesson_id, exercise.id)`` matches the
     *       error's recorded exercise (avoid same-exercise
     *       repeat — the user already saw it fail).
     *    2. Score same-exercise_type candidates lower per the
     *       ``variation_factor`` weight (prefer a shape change
     *       over a re-run of the same form).
     *  Omit to disable variation entirely (every candidate is
     *  in scope; tied candidates fall through to the type-mix
     *  deficit rule alone). */
    errorsByElementKey?: ReadonlyMap<string, ElementError>;
}

function _resolveConfig(
    overrides: Partial<GeneratorConfig> | undefined,
): GeneratorConfig {
    if (!overrides) return DEFAULT_GENERATOR_CONFIG;
    return {
        ...DEFAULT_GENERATOR_CONFIG,
        ...overrides,
        exercise_type_mix: {
            ...DEFAULT_GENERATOR_CONFIG.exercise_type_mix,
            ...(overrides.exercise_type_mix ?? {}),
        },
    };
}

/** Group candidates by element_key, preserving the input
 *  order inside each group. */
function _groupByElement(
    pool: readonly ExerciseCandidate[],
): Map<string, ExerciseCandidate[]> {
    const out = new Map<string, ExerciseCandidate[]>();
    for (const cand of pool) {
        const arr = out.get(cand.element_key) ?? [];
        arr.push(cand);
        out.set(cand.element_key, arr);
    }
    return out;
}

/** For one element, pick the candidate that best satisfies
 *  the type-mix target — i.e. whose type currently shows the
 *  largest deficit (target - current). Ties broken by lower
 *  difficulty estimate, then by exercise.id alphabetical for
 *  cross-runtime determinism. Returns null when ``candidates``
 *  is empty.
 *
 *  When ``sourceError`` is non-null AND ``variationFactor`` is
 *  in (0, 1], same-exercise_type candidates are penalised by
 *  ``variationFactor`` units of deficit so the picker prefers
 *  a shape change over a re-run. The penalty is a soft signal
 *  — a candidate with a huge mix deficit still wins over a
 *  shape-changed candidate with a small deficit. At
 *  ``variationFactor === 0`` the penalty is zero and the
 *  picker behaves identically to the 53C baseline. */
function _pickByMixDeficit(
    candidates: readonly ExerciseCandidate[],
    typeCounts: Map<string, number>,
    targets: Map<string, number>,
    sourceType: string | null,
    variationFactor: number,
): ExerciseCandidate | null {
    if (candidates.length === 0) return null;
    let best: ExerciseCandidate | null = null;
    let bestKey: [number, number, number, string] | null = null;
    for (const cand of candidates) {
        const current = typeCounts.get(cand.exercise_type) ?? 0;
        const target = targets.get(cand.exercise_type) ?? 0;
        const deficit = target - current;
        const sameSourceType =
            sourceType !== null && cand.exercise_type === sourceType;
        const variationPenalty = sameSourceType ? variationFactor : 0;
        // Sort tuple (ascending):
        //   1. -(deficit - variationPenalty)  => largest effective deficit wins
        //   2. is_generated last (prefer authored unless variation pushes us)
        //   3. difficulty_estimate            => easier first per ascending intuition
        //   4. exercise.id alphabetical       => parity tie-break
        const effectiveDeficit = deficit - variationPenalty;
        const sortKey: [number, number, number, string] = [
            -effectiveDeficit,
            cand.is_generated ? 1 : 0,
            cand.difficulty_estimate,
            cand.exercise.id,
        ];
        if (bestKey === null || _tupleLt(sortKey, bestKey)) {
            best = cand;
            bestKey = sortKey;
        }
    }
    return best;
}

/** Heuristic: infer the source exercise's type by looking at
 *  the candidates that share the source's exercise.id. When
 *  none matches (the source exercise wasn't pooled), return
 *  null and the variation penalty doesn't fire. */
function _sourceExerciseType(
    sourceError: ElementError | null,
    candidates: readonly ExerciseCandidate[],
): string | null {
    if (sourceError === null) return null;
    for (const cand of candidates) {
        if (
            !cand.is_generated &&
            cand.source_lesson_id === sourceError.lesson_id &&
            cand.exercise.id === sourceError.exercise_id
        ) {
            return cand.exercise_type;
        }
    }
    return null;
}

function _tupleLt(
    a: [number, number, number, string],
    b: [number, number, number, string],
): boolean {
    if (a[0] !== b[0]) return a[0] < b[0];
    if (a[1] !== b[1]) return a[1] < b[1];
    if (a[2] !== b[2]) return a[2] < b[2];
    return a[3] < b[3];
}

/** Filter out the candidate that LITERALLY replays the source
 *  error (same lesson + same exercise.id). Generated cloze
 *  candidates have a synthetic exercise.id so they survive
 *  this filter. */
function _filterReplays(
    candidates: readonly ExerciseCandidate[],
    sourceError: ElementError | null,
): ExerciseCandidate[] {
    if (sourceError === null) return [...candidates];
    return candidates.filter(
        (c) =>
            c.is_generated ||
            c.source_lesson_id !== sourceError.lesson_id ||
            c.exercise.id !== sourceError.exercise_id,
    );
}

/** Build the target-count map: per type, what fraction of
 *  ``max_exercises`` we want. */
function _buildTargets(config: GeneratorConfig): Map<string, number> {
    const out = new Map<string, number>();
    const max = config.max_exercises;
    for (const [type, share] of Object.entries(config.exercise_type_mix)) {
        out.set(type, share * max);
    }
    return out;
}

/** Walk the priority list cycling until we've collected
 *  ``max_exercises`` candidates OR run out of fresh
 *  (element, exercise.id) pairs. */
function _selectCandidates(
    prioritized: readonly PrioritizedElement[],
    pool: readonly ExerciseCandidate[],
    config: GeneratorConfig,
    errorsByElementKey: ReadonlyMap<string, ElementError> | undefined,
): ExerciseCandidate[] {
    const grouped = _groupByElement(pool);
    const targets = _buildTargets(config);
    const typeCounts = new Map<string, number>();
    const selected: ExerciseCandidate[] = [];
    // Track used (lesson, exercise) per element so iterations
    // don't repeat selections.
    const usedByElement = new Map<string, Set<string>>();

    const maxIterations = Math.max(1, prioritized.length * 5);
    let iter = 0;
    while (selected.length < config.max_exercises && iter < maxIterations) {
        let progress = false;
        for (const target of prioritized) {
            if (selected.length >= config.max_exercises) break;
            const groupKey = target.element_key;
            const raw = grouped.get(groupKey) ?? [];
            if (raw.length === 0) continue;
            const sourceError = errorsByElementKey?.get(groupKey) ?? null;
            // Capture the source exercise's type BEFORE filtering
            // it out — the variation penalty consults it. Once
            // filtered, the source candidate isn't visible to
            // _sourceExerciseType anymore.
            const sourceType = _sourceExerciseType(sourceError, raw);
            // Variation: strip literal-replay candidates of the
            // source error. Generated cloze candidates survive
            // (they carry a synthetic id).
            const variationFiltered = _filterReplays(raw, sourceError);
            const used = usedByElement.get(groupKey) ?? new Set<string>();
            const available = variationFiltered.filter(
                (c) => !used.has(`${c.source_lesson_id}::${c.exercise.id}`),
            );
            if (available.length === 0) continue;
            const pick = _pickByMixDeficit(
                available,
                typeCounts,
                targets,
                sourceType,
                config.variation_factor,
            );
            if (!pick) continue;
            selected.push(pick);
            used.add(`${pick.source_lesson_id}::${pick.exercise.id}`);
            usedByElement.set(groupKey, used);
            typeCounts.set(
                pick.exercise_type,
                (typeCounts.get(pick.exercise_type) ?? 0) + 1,
            );
            progress = true;
        }
        if (!progress) break;
        iter += 1;
    }
    return selected;
}

/** Sort the chosen exercises into the configured curve. */
function _sortByDifficulty(
    candidates: ExerciseCandidate[],
    curve: DifficultyCurve,
): ExerciseCandidate[] {
    const copy = [...candidates];
    if (curve === "ascending") {
        copy.sort(
            (a, b) =>
                a.difficulty_estimate - b.difficulty_estimate ||
                (a.exercise.id < b.exercise.id ? -1 : 1),
        );
    } else if (curve === "descending") {
        copy.sort(
            (a, b) =>
                b.difficulty_estimate - a.difficulty_estimate ||
                (a.exercise.id < b.exercise.id ? -1 : 1),
        );
    }
    // "mixed" preserves selection order — the priority walk
    // already interleaves the elements, which IS a mix.
    return copy;
}

/** Pull a theory step from the dominant cluster's source
 *  lessons. Returns null when no theory step can be
 *  located (cluster's lessons aren't cached, OR they hold
 *  no theory steps). */
function _theoryStepForCluster(
    analysis: ErrorAnalysis,
    lessons: ReadonlyMap<string, ContentLesson>,
): ContentLessonStep | null {
    if (analysis.error_clusters.length === 0) return null;
    // Pick the cluster with the highest error_count_total
    // that's a "lesson" cluster — those have a directly
    // resolvable source lesson_id. Falls back to scanning
    // all cached lessons for an element_type cluster.
    for (const cluster of analysis.error_clusters) {
        if (cluster.cluster_type === "lesson") {
            const lesson = lessons.get(cluster.key);
            if (!lesson) continue;
            const theoryStep = lesson.steps.find((s) => s.type === "theory");
            if (theoryStep) {
                return {
                    ...theoryStep,
                    // Embed the cluster context in the id so
                    // anchor links won't collide with the
                    // original lesson's anchors.
                    id: `adaptive-theory-${cluster.key}-${theoryStep.id}`,
                };
            }
        }
    }
    // element_type clusters: scan all cached lessons for any
    // theory step. Prefer lessons whose ids appear under any
    // element_keys in the cluster.
    for (const cluster of analysis.error_clusters) {
        if (cluster.cluster_type !== "element_type") continue;
        for (const [lessonId, lesson] of lessons) {
            const theoryStep = lesson.steps.find((s) => s.type === "theory");
            if (theoryStep) {
                return {
                    ...theoryStep,
                    id: `adaptive-theory-${cluster.key}-${theoryStep.id}-${lessonId}`,
                };
            }
        }
    }
    return null;
}

function _exerciseStep(
    cand: ExerciseCandidate,
    index: number,
): ContentLessonStep {
    return {
        id: `adaptive-step-${index}-${cand.element_key}-${cand.exercise.id}`,
        type: "exercise",
        title: null,
        body: null,
        exercise: cand.exercise,
    };
}

/** Synthesise the adaptive lesson. */
export function generateAdaptiveLesson(
    analysis: ErrorAnalysis,
    pool: readonly ExerciseCandidate[],
    opts: GenerateOpts,
): ContentLesson {
    const config = _resolveConfig(opts.config);
    const selected = _selectCandidates(
        analysis.prioritized_elements,
        pool,
        config,
        opts.errorsByElementKey,
    );
    const sorted = _sortByDifficulty(selected, config.difficulty_curve);
    const steps: ContentLessonStep[] = [];
    const theory = _theoryStepForCluster(analysis, opts.lessons);
    if (theory) steps.push(theory);
    sorted.forEach((cand, idx) => steps.push(_exerciseStep(cand, idx)));
    return {
        id: `adaptive-${opts.set_id}-${opts.now}`,
        title: opts.title,
        description: opts.description ?? null,
        estimated_minutes: Math.max(1, Math.round(steps.length / 2)),
        cards: [],
        steps,
    };
}
