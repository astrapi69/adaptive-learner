/**
 * AIV-07 (#3060, EXP-033 § 8): apply the set-wide AI check's field
 * suggestions to a set the learner owns, reviewed and reversible.
 *
 * The check (AIV-01..05) returns per-card findings ``{field, problem,
 * suggestion}`` where ``suggestion`` is "the corrected value or guidance".
 * This module never decides that ambiguity on its own: {@link planFixes}
 * turns every finding that names a card text field and carries a
 * suggestion into a {@link FixCandidate} (current value next to the
 * suggested one) and lists everything else as manual; the learner
 * unticks prose rows in the review step before {@link applyFixes} writes.
 *
 * Writing goes through the editor's whole-set path (``saveUserSet``): the
 * input is rebuilt from the catalog entry plus ALL lessons, so no set
 * metadata is lost, card ids never change (progress keys stay valid), and
 * every applied field is recorded in a {@link FixSnapshot} that
 * {@link undoFixes} can play back. Pure functions, no storage access;
 * the hook owns the reads and writes.
 *
 * @example
 * const plan = planFixes(report.results, lessons);
 * const {input, snapshot} = applyFixes(entry, lessons, plan.candidates, now);
 * await getStorage().contentLoader.saveUserSet(input);
 */

import type {
    ContentLesson,
    ContentSetEntry,
    SaveUserSetInput,
    UserLessonOrigin,
} from "../../../storage/types";
import type {ValidationResult} from "../../ai/validation/content-validator";

/** The card text fields a suggestion may be written into. */
export type FixableField = "front" | "back" | "notes";

const FIXABLE_FIELDS: readonly FixableField[] = ["front", "back", "notes"];
const USER_ORIGINS: readonly UserLessonOrigin[] = ["analysis", "adaptive", "imported"];

/** One reviewable replacement: a card field, its current and suggested value. */
export interface FixCandidate {
    /** ``<cardId>::<field>``, stable across renders. */
    key: string;
    lessonId: string;
    lessonTitle: string;
    cardId: string;
    /** The card front, for the review row label. */
    front: string;
    field: FixableField;
    before: string;
    after: string;
    problem: string;
}

/** A finding the learner has to act on by hand (no card field, no value, unknown card). */
export interface ManualFinding {
    cardId: string;
    front: string;
    field: string;
    problem: string;
    suggestion: string;
}

export interface FixPlan {
    candidates: FixCandidate[];
    manual: ManualFinding[];
}

/** One applied replacement, as recorded for undo. */
export interface FixChange {
    lessonId: string;
    cardId: string;
    field: FixableField;
    before: string;
    after: string;
}

/** What {@link applyFixes} wrote, enough for {@link undoFixes} to play it back. */
export interface FixSnapshot {
    source: string;
    setId: string;
    /** ISO timestamp of the apply. */
    appliedAt: string;
    changes: FixChange[];
}

type Card = ContentLesson["cards"][number];

interface CardRef {
    lesson: ContentLesson;
    card: Card;
}

function isFixableField(field: string): field is FixableField {
    return (FIXABLE_FIELDS as readonly string[]).includes(field);
}

function fieldValue(card: Card, field: FixableField): string {
    const value = (card as unknown as Record<string, unknown>)[field];
    return typeof value === "string" ? value : "";
}

function indexCards(lessons: readonly ContentLesson[]): Map<string, CardRef> {
    const index = new Map<string, CardRef>();
    for (const lesson of lessons) {
        for (const card of lesson.cards) index.set(card.id, {lesson, card});
    }
    return index;
}

/**
 * Split a report into applicable replacements and manual findings.
 *
 * A candidate needs a known card, a text field (front, back, notes) and a
 * non-empty suggestion; one candidate per card field (the first finding
 * wins). A suggestion equal to the current value is dropped as a no-op;
 * a finding on an unknown card, a non-text field or without a suggestion
 * stays manual.
 */
export function planFixes(
    results: readonly ValidationResult[],
    lessons: readonly ContentLesson[],
): FixPlan {
    const index = indexCards(lessons);
    const candidates: FixCandidate[] = [];
    const manual: ManualFinding[] = [];
    const seen = new Set<string>();
    for (const result of results) {
        if (result.ok) continue;
        const ref = index.get(result.card_id);
        for (const issue of result.issues) {
            const suggestion = issue.suggestion.trim();
            const key = `${result.card_id}::${issue.field}`;
            if (ref !== undefined && isFixableField(issue.field) && suggestion !== "") {
                // A suggestion equal to the current value is a no-op: the
                // report still shows the finding, there is nothing to write.
                if (suggestion === fieldValue(ref.card, issue.field) || seen.has(key)) continue;
                seen.add(key);
                candidates.push({
                    key,
                    lessonId: ref.lesson.id,
                    lessonTitle: ref.lesson.title,
                    cardId: ref.card.id,
                    front: ref.card.front,
                    field: issue.field,
                    before: fieldValue(ref.card, issue.field),
                    after: suggestion,
                    problem: issue.problem,
                });
            } else {
                manual.push({
                    cardId: result.card_id,
                    front: ref?.card.front ?? result.card_id,
                    field: issue.field,
                    problem: issue.problem,
                    suggestion: issue.suggestion,
                });
            }
        }
    }
    return {candidates, manual};
}

function originOf(entry: ContentSetEntry): UserLessonOrigin {
    return (USER_ORIGINS as readonly string[]).includes(entry.domain)
        ? (entry.domain as UserLessonOrigin)
        : "imported";
}

/**
 * The whole-set write input for a user set, rebuilt from its catalog entry
 * (the writer stores the origin in ``domain``) plus the given lessons.
 */
export function buildResaveInput(
    entry: ContentSetEntry,
    lessons: readonly ContentLesson[],
): SaveUserSetInput {
    return {
        set_id: entry.id,
        title: entry.title,
        title_native: entry.title_native ?? null,
        language: entry.language,
        target_language: entry.target_language,
        source_language: entry.source_language,
        level: entry.level,
        origin: originOf(entry),
        description: entry.description,
        book: entry.book ?? null,
        attribution: entry.attribution ?? null,
        lessons: [...lessons],
    };
}

function writeField(lessons: ContentLesson[], change: FixChange): boolean {
    const lesson = lessons.find((l) => l.id === change.lessonId);
    const card = lesson?.cards.find((c) => c.id === change.cardId);
    if (!card) return false;
    (card as unknown as Record<string, unknown>)[change.field] = change.after;
    return true;
}

/**
 * Apply the selected candidates to a copy of the lessons and return the
 * write input plus the undo snapshot. The caller's lessons stay untouched.
 */
export function applyFixes(
    entry: ContentSetEntry,
    lessons: readonly ContentLesson[],
    selected: readonly FixCandidate[],
    now: string,
): {input: SaveUserSetInput; snapshot: FixSnapshot} {
    const copy = structuredClone(lessons) as ContentLesson[];
    const changes: FixChange[] = [];
    for (const candidate of selected) {
        const change: FixChange = {
            lessonId: candidate.lessonId,
            cardId: candidate.cardId,
            field: candidate.field,
            before: candidate.before,
            after: candidate.after,
        };
        if (writeField(copy, change)) changes.push(change);
    }
    return {
        input: buildResaveInput(entry, copy),
        snapshot: {source: entry.source, setId: entry.id, appliedAt: now, changes},
    };
}

/**
 * Play a snapshot back: every recorded field whose applied value is still
 * in place gets its previous value again; a field the learner edited since
 * is left alone. Returns the write input and how many fields were restored.
 */
export function undoFixes(
    entry: ContentSetEntry,
    lessons: readonly ContentLesson[],
    snapshot: FixSnapshot,
): {input: SaveUserSetInput; restored: number} {
    const copy = structuredClone(lessons) as ContentLesson[];
    let restored = 0;
    for (const change of snapshot.changes) {
        const lesson = copy.find((l) => l.id === change.lessonId);
        const card = lesson?.cards.find((c) => c.id === change.cardId);
        if (!card || fieldValue(card, change.field) !== change.after) continue;
        (card as unknown as Record<string, unknown>)[change.field] = change.before;
        restored++;
    }
    return {input: buildResaveInput(entry, copy), restored};
}
