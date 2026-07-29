/**
 * update-impact — the heart of the set-update identity guard (#2128).
 *
 * A content update replaces content only and never touches LessonProgress /
 * ElementError (proven both-mode in #2128 / #2129). Progress therefore
 * survives an update only while the identity strings it pins to stay stable:
 * the lesson FILENAME (LessonProgress) and the (lesson_id, exercise_id,
 * element_key) tuple (ElementError / SRS). This module compares the
 * identities a learner already holds against the identities an INCOMING set
 * version actually contains, so the caller can decide BEFORE applying whether
 * the update would silently orphan progress.
 *
 * Pure + side-effect-free: the caller supplies the learner's rows (read via
 * getStorage, mode-agnostic) and the incoming identities (peeked over HTTP,
 * storage-mode-independent).
 */

/** Minimal shape of a lesson exercise this module reads (a subset of
 *  ContentLessonExercise) — kept structural so the peek can pass raw
 *  parsed JSON without importing the full engine type. */
export interface PeekExercise {
    id?: string;
    type?: string;
    pairs?: ({left?: string} | null)[] | null;
    accept?: string[] | null;
    tiles?: string[] | null;
    images?: ({label?: string; is_correct?: string} | null)[] | null;
    blanks?: ({accept?: string[]} | null)[] | null;
}

/** A lesson as the peek sees it: its filename + its exercises. */
export interface PeekLesson {
    filename: string;
    exercises: PeekExercise[];
}

/** matching: one key per authored pair (``pair.left``). */
function matchingKeys(ex: PeekExercise): Set<string> {
    const keys = new Set<string>();
    for (const p of ex.pairs ?? []) {
        if (p && typeof p.left === "string") keys.add(p.left);
    }
    return keys;
}

/** free_text (and the cloze fallback): the first accepted answer. */
function firstAcceptKey(ex: PeekExercise): Set<string> {
    return ex.accept?.[0] !== undefined ? new Set([ex.accept[0]]) : new Set();
}

/** word_tiles: the canonical ``tiles.join(" ")`` phrase. */
function wordTilesKeys(ex: PeekExercise): Set<string> {
    return ex.tiles ? new Set([ex.tiles.join(" ")]) : new Set();
}

/** picture_choice: the correct image's label. */
function pictureChoiceKeys(ex: PeekExercise): Set<string> {
    const keys = new Set<string>();
    for (const img of ex.images ?? []) {
        if (img && img.is_correct === "true" && typeof img.label === "string") {
            keys.add(img.label);
        }
    }
    return keys;
}

/** cloze: one key per blank (``blank.accept[0]``), or the exercise-level
 *  ``accept[0]`` when there are no authored blanks. */
function clozeKeys(ex: PeekExercise): Set<string> {
    if (!ex.blanks || ex.blanks.length === 0) return firstAcceptKey(ex);
    const keys = new Set<string>();
    for (const b of ex.blanks) {
        if (b?.accept?.[0] !== undefined) keys.add(b.accept[0]);
    }
    return keys;
}

const ELEMENT_KEY_EXTRACTORS: Record<string, (ex: PeekExercise) => Set<string>> = {
    matching: matchingKeys,
    free_text: firstAcceptKey,
    word_tiles: wordTilesKeys,
    picture_choice: pictureChoiceKeys,
    cloze: clozeKeys,
};

/**
 * The element_keys an exercise contributes to the SRS, mirroring
 * ``lib/srs/element-attempt.ts`` for the five shipped content types. For any
 * OTHER type the set is EMPTY on purpose: an SRS row on an unhandled type
 * then fails the "still resolves" check and is conservatively flagged
 * at-risk — the guard must never under-warn (silently lose progress).
 */
export function exerciseElementKeys(ex: PeekExercise): Set<string> {
    const extractor = ELEMENT_KEY_EXTRACTORS[ex.type ?? ""];
    return extractor ? extractor(ex) : new Set();
}

/** Fold peeked lessons into the {@link IncomingSetIdentities} the impact
 *  check consumes. */
export function buildIncomingIdentities(
    lessons: readonly PeekLesson[],
): IncomingSetIdentities {
    const byLesson = new Map<string, Map<string, Set<string>>>();
    const lessonSet = new Set<string>();
    for (const lesson of lessons) {
        lessonSet.add(lesson.filename);
        const byEx = new Map<string, Set<string>>();
        for (const ex of lesson.exercises) {
            if (ex.id) byEx.set(ex.id, exerciseElementKeys(ex));
        }
        byLesson.set(lesson.filename, byEx);
    }
    return {lessons: lessonSet, byLesson};
}

/** The SRS identity a learner's ElementError row pins to. */
export interface SrsIdentity {
    /** Lesson filename (ElementError.lesson_id). */
    lesson_id: string;
    exercise_id: string;
    element_key: string;
}

/**
 * The identities an incoming (not-yet-applied) set version contains:
 * the lesson filenames, and per lesson a map of exercise_id -> the set of
 * element_keys that exercise contributes to the SRS (mirrors
 * ``lib/srs/element-attempt.ts``).
 */
export interface IncomingSetIdentities {
    lessons: ReadonlySet<string>;
    byLesson: ReadonlyMap<string, ReadonlyMap<string, ReadonlySet<string>>>;
}

export interface UpdateImpact {
    /** Distinct progress lesson filenames the incoming version no longer has. */
    lostLessons: string[];
    /** SRS identities the incoming version no longer resolves. */
    lostCards: SrsIdentity[];
    /** True when applying the update would orphan any progress-bearing identity. */
    breaking: boolean;
}

/**
 * Decide the impact of applying ``incoming`` on a learner who holds the given
 * progress + SRS identities. ``breaking`` is true iff at least one identity
 * the learner has would no longer resolve — that is exactly when the update
 * must be held for a decision instead of auto-applied. A superset update
 * (added lessons / exercises / accept-variants) is never breaking.
 */
export function computeUpdateImpact(
    progressLessonFilenames: readonly string[],
    srsIdentities: readonly SrsIdentity[],
    incoming: IncomingSetIdentities,
): UpdateImpact {
    const lostLessons = [...new Set(progressLessonFilenames)].filter(
        (filename) => !incoming.lessons.has(filename),
    );
    const lostCards = srsIdentities.filter((identity) => {
        const keys = incoming.byLesson.get(identity.lesson_id)?.get(
            identity.exercise_id,
        );
        return !keys || !keys.has(identity.element_key);
    });
    return {
        lostLessons,
        lostCards,
        breaking: lostLessons.length > 0 || lostCards.length > 0,
    };
}
