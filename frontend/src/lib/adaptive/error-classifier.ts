/**
 * Error classifier for language-specific patterns
 * (Phase 53E / v1.36.0 / EXP-013 / P-139, P-140).
 *
 * Maps each ``ElementError`` to zero or more semantic tags
 * (e.g. ``"article_gender"``, ``"spelling_accent"``,
 * ``"verb_conjugation"``, ``"word_order"``) so the Dashboard
 * widget can render plain-language "Your challenge areas"
 * copy and the lesson generator can pick appropriate theory
 * refreshers per cluster.
 *
 * Pure + derived: tags are recomputed from the error +
 * (optional) source-card context every time. The Phase 53
 * spec also calls for persisting tags on each ``ElementError``
 * row (P-140), with the matching Alembic migration + Dexie
 * schema bump + sync-surface entry. That persistence track is
 * DEFERRED to a follow-up — the tags are deterministic from
 * the existing fields, so storing them is an optimisation,
 * not a correctness requirement. When the persistence track
 * lands, this classifier becomes the canonical assignor (the
 * write path runs it once per attempt and stores the result).
 *
 * Pattern catalogue:
 *
 *   - ``article_gender``: same element_key sits inside a
 *     known closed set of articles (``le``/``la``/``les``,
 *     ``el``/``la``/``los``/``las``, ``der``/``die``/``das``)
 *     AND the user's answer swapped one for another.
 *     Falls back to: card.token_roles contains a token with
 *     role ``"article"`` matching the element_key.
 *
 *   - ``spelling_accent``: ``user_answer`` differs from
 *     ``correct_answer`` only in accented characters
 *     (Unicode normalisation NFD-strip equality).
 *
 *   - ``verb_conjugation``: card.token_roles contains a
 *     token with role ``"verb"`` equal to the element_key,
 *     OR element_type === ``"grammar_rule"`` AND the
 *     element_key sits inside a known conjugation surface
 *     (heuristic, low-confidence).
 *
 *   - ``word_order``: the source exercise is of type
 *     ``"word_tiles"`` (the only exercise type that tests
 *     sequencing). The error itself only carries an
 *     element_key + answers, so this tag is inferred via
 *     the source-lesson lookup.
 *
 *   - ``false_friend``: deferred. Heuristic requires a
 *     bilingual lookup table; implement when content set
 *     metadata ships false-friend pairs.
 */

import type {
    ContentLesson,
    ContentLessonCard,
    ElementError,
} from "../../storage/types";

import {matchesExerciseIdentity} from "../srs/exercise-identity";
import type {ErrorCluster, PrioritizedElement} from "./types";

export type ErrorTag =
    | "article_gender"
    | "spelling_accent"
    | "verb_conjugation"
    | "word_order";

/** Closed sets of articles per supported language. Used by
 *  the article_gender heuristic to detect "user swapped one
 *  article for another" without per-language metadata. */
const ARTICLE_SETS: ReadonlySet<string>[] = [
    new Set(["le", "la", "les", "l'", "un", "une", "des"]), // French
    new Set(["el", "la", "los", "las", "un", "una", "unos", "unas"]), // Spanish
    new Set(["der", "die", "das", "den", "dem", "des"]), // German
    new Set(["the", "a", "an"]), // English
];

function _isArticle(token: string): boolean {
    if (!token) return false;
    const lower = token.toLowerCase();
    return ARTICLE_SETS.some((set) => set.has(lower));
}

/** Article-gender heuristic: BOTH ``user_answer`` and
 *  ``correct_answer`` are members of the same closed article
 *  set, and they differ. */
function _isArticleGenderError(error: ElementError): boolean {
    if (!error.user_answer || !error.correct_answer) return false;
    if (error.user_answer === error.correct_answer) return false;
    const userLower = error.user_answer.toLowerCase();
    const correctLower = error.correct_answer.toLowerCase();
    for (const set of ARTICLE_SETS) {
        if (set.has(userLower) && set.has(correctLower)) return true;
    }
    return false;
}

/** Spelling-accent heuristic: the user_answer and
 *  correct_answer become equal under Unicode NFD
 *  decomposition + diacritic-strip. */
function _isSpellingAccentError(error: ElementError): boolean {
    if (!error.user_answer || !error.correct_answer) return false;
    if (error.user_answer === error.correct_answer) return false;
    const strip = (s: string) =>
        s
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .toLowerCase();
    return strip(error.user_answer) === strip(error.correct_answer);
}

/** Verb-conjugation heuristic via token_roles lookup. */
function _isVerbConjugationError(
    error: ElementError,
    sourceCard: ContentLessonCard | null,
): boolean {
    if (!sourceCard?.token_roles) return false;
    return sourceCard.token_roles.some(
        (tr) => tr.role === "verb" && tr.token === error.element_key,
    );
}

/** Word-order heuristic: the source exercise is of type
 *  ``word_tiles``. Requires a source-lesson lookup. */
function _isWordOrderError(
    error: ElementError,
    sourceLesson: ContentLesson | undefined,
): boolean {
    if (!sourceLesson) return false;
    for (const step of sourceLesson.steps) {
        // #2130: rows resolve under either the authored slug or stable_id.
        if (step.exercise && matchesExerciseIdentity(step.exercise, error.exercise_id)) {
            return step.exercise.type === "word_tiles";
        }
    }
    return false;
}

export interface ClassifyOpts {
    /** Cached lessons keyed by lesson_id. The classifier reads
     *  card.token_roles + exercise.type from here for the
     *  context-aware heuristics. Omit to fall back to the
     *  context-free heuristics (article_gender +
     *  spelling_accent — they only look at the error's own
     *  fields). */
    lessons?: ReadonlyMap<string, ContentLesson>;
}

/** Classify ONE error. Returns an empty array when no
 *  heuristic matches — the absence of a tag is meaningful. */
export function classifyError(
    error: ElementError,
    opts: ClassifyOpts = {},
): ErrorTag[] {
    const tags = new Set<ErrorTag>();
    const lessons = opts.lessons;
    const sourceLesson = lessons?.get(error.lesson_id);
    const sourceCard = _findSourceCard(sourceLesson, error);
    if (_isArticleGenderError(error) || _hasArticleTokenRole(sourceCard, error)) {
        tags.add("article_gender");
    }
    if (_isSpellingAccentError(error)) {
        tags.add("spelling_accent");
    }
    if (_isVerbConjugationError(error, sourceCard)) {
        tags.add("verb_conjugation");
    }
    if (_isWordOrderError(error, sourceLesson)) {
        tags.add("word_order");
    }
    return Array.from(tags).sort();
}

function _findSourceCard(
    lesson: ContentLesson | undefined,
    error: ElementError,
): ContentLessonCard | null {
    if (!lesson) return null;
    let sourceExerciseCardIds: string[] | null = null;
    for (const step of lesson.steps) {
        if (step.exercise && matchesExerciseIdentity(step.exercise, error.exercise_id)) {
            // card_ids is optional at runtime (card-less types omit it, #1636);
            // a card-less source exercise has no cards to inspect -> null below.
            sourceExerciseCardIds = step.exercise.card_ids ?? null;
            break;
        }
    }
    if (!sourceExerciseCardIds) return null;
    for (const card of lesson.cards) {
        if (sourceExerciseCardIds.includes(card.id)) {
            // Prefer a card whose front equals the element_key or
            // whose token_roles contain it.
            if (card.front === error.element_key) return card;
            if (
                card.token_roles?.some((tr) => tr.token === error.element_key)
            ) {
                return card;
            }
        }
    }
    // Fall back to the first referenced card so the verb +
    // article heuristics can still inspect token_roles.
    return (
        lesson.cards.find((c) => sourceExerciseCardIds!.includes(c.id)) ?? null
    );
}

function _hasArticleTokenRole(
    sourceCard: ContentLessonCard | null,
    error: ElementError,
): boolean {
    if (!sourceCard?.token_roles) return false;
    return sourceCard.token_roles.some(
        (tr) =>
            tr.role === "article" &&
            tr.token === error.element_key &&
            // Also require the user_answer to LOOK like an article;
            // otherwise we're catching "wrong noun next to an
            // article" cases.
            _isArticle(error.user_answer),
    );
}

/** Enrich an existing cluster set with classification tags.
 *  For each element_type cluster, scan the source errors and
 *  collect the tag set across the cluster. Outputs a new
 *  ``ErrorCluster`` array with an extra ``tags`` field on
 *  matching entries. */
export interface ClassifiedCluster extends ErrorCluster {
    tags: ErrorTag[];
}

export interface ClassifyClustersOpts {
    /** All errors that participated in the analysis. The
     *  classifier walks them to produce per-cluster tag sets. */
    errors: readonly ElementError[];
    /** See :class:`ClassifyOpts`. */
    lessons?: ReadonlyMap<string, ContentLesson>;
}

/**
 * Classify error clusters into language-specific weakness categories
 * (article gender, spelling/accent, verb conjugation, word order, ...) that
 * drive adaptive-lesson generation.
 *
 * @param clusters - Raw error clusters derived from the learner's history.
 * @param opts - Classification options (domain/language context).
 * @return One classified cluster per input cluster.
 */
export function classifyClusters(
    clusters: readonly ErrorCluster[],
    opts: ClassifyClustersOpts,
): ClassifiedCluster[] {
    const tagsByElementKey = new Map<string, Set<ErrorTag>>();
    for (const error of opts.errors) {
        const tags = classifyError(error, {lessons: opts.lessons});
        if (tags.length === 0) continue;
        const existing = tagsByElementKey.get(error.element_key) ?? new Set();
        for (const tag of tags) existing.add(tag);
        tagsByElementKey.set(error.element_key, existing);
    }
    const out: ClassifiedCluster[] = [];
    for (const cluster of clusters) {
        const clusterTags = new Set<ErrorTag>();
        for (const key of cluster.element_keys) {
            const elementTags = tagsByElementKey.get(key);
            if (!elementTags) continue;
            for (const tag of elementTags) clusterTags.add(tag);
        }
        out.push({
            ...cluster,
            tags: Array.from(clusterTags).sort(),
        });
    }
    return out;
}

/** Convenience: tag set for the suggested-focus elements.
 *  Used by the Dashboard widget to render the
 *  "Your challenge areas" chips. */
export function focusAreaTags(
    suggested: readonly PrioritizedElement[],
    errors: readonly ElementError[],
    opts: ClassifyOpts = {},
): ErrorTag[] {
    const indexed = new Map<string, ElementError>();
    for (const err of errors) indexed.set(err.element_key, err);
    const all = new Set<ErrorTag>();
    for (const target of suggested) {
        const err = indexed.get(target.element_key);
        if (!err) continue;
        for (const tag of classifyError(err, opts)) all.add(tag);
    }
    return Array.from(all).sort();
}
