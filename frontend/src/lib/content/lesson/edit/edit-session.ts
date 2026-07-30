/**
 * Edit-session helpers for the Lesson Creator (#1971).
 *
 * A user set can hold MORE THAN ONE lesson (a book-text multi-section upload,
 * #1949, stores one ``ContentLesson`` per section). The edit wizard lets the
 * user pick which lesson to edit; these helpers load the set, build the
 * per-lesson wizard prefill, snapshot it for unsaved-edit detection, and merge
 * the edited lesson back into the set WITHOUT clobbering the set-level metadata
 * (title / level / languages) with the edited lesson's own values.
 *
 * Kept out of the page component (pure + storage-only, no React) so
 * ``CreateLesson`` stays under the cohesion size gate.
 */

import {getStorage} from "../../../../storage";
import {lessonToDraftInput} from "../draft-to-lesson";
import {migrateLegacyExercisePrompts} from "../exercise/legacy-prompt-migration";
import type {LessonCardDraft, LessonMeta} from "../lesson-draft";
import type {
    ContentLesson,
    ContentLessonExercise,
    ContentLessonStep,
    ContentSetEntry,
    SaveUserSetInput,
    UserLessonOrigin,
} from "../../../../storage/types";

type Translate = (key: string, fallback?: string) => string;

/** The full set (all lessons + its catalog entry) the wizard was opened on. */
export interface EditLessonSet {
    lessons: ContentLesson[];
    entry?: ContentSetEntry;
}

/** Load a user set for editing: every lesson (the edited one + its siblings)
 *  plus the set's catalog entry. Throws when the set has no lessons. */
export async function fetchEditLessonSet(
    source: string,
    setId: string,
): Promise<EditLessonSet> {
    const storage = getStorage();
    const [listing, setsList] = await Promise.all([
        storage.contentLoader.listLessons(source, setId),
        storage.contentLoader.listSets(),
    ]);
    if (listing.lessons.length === 0) {
        throw new Error("This set has no lessons to edit.");
    }
    const lessons = await Promise.all(
        listing.lessons.map((f) =>
            storage.contentLoader.getLesson(source, setId, f),
        ),
    );
    const entry = setsList.sets.find(
        (s) => s.source === source && s.id === setId,
    );
    return {lessons, entry};
}

/** A stable string snapshot of the editable draft — compared against the
 *  live wizard state to detect unsaved edits before switching lessons. */
export function editSnapshot(
    meta: LessonMeta,
    cards: LessonCardDraft[],
    exercises: ContentLessonExercise[],
): string {
    return JSON.stringify({meta, cards, exercises});
}

/** Everything needed to pre-fill the wizard for ONE lesson of the set. */
export interface EditPrefill {
    meta: LessonMeta;
    cards: LessonCardDraft[];
    exercises: ContentLessonExercise[];
    /** A cardless (book/theory) lesson edits its exercises directly (#1967). */
    cardless: boolean;
    /** How many legacy English prompts were migrated on load (#1860). */
    migratedCount: number;
    origin: UserLessonOrigin;
    originalSteps: ContentLessonStep[];
    lessonId: string;
    snapshot: string;
}

/** Build the wizard prefill for ``lesson`` (of the set described by ``entry``),
 *  opportunistically migrating legacy hardcoded-English prompts (#1860). */
export function buildEditPrefill(
    lesson: ContentLesson,
    entry: ContentSetEntry | undefined,
    t: Translate,
): EditPrefill {
    const prefill = lessonToDraftInput(lesson, entry);
    const {exercises, migratedCount} = migrateLegacyExercisePrompts(
        prefill.exercises,
        t,
    );
    return {
        meta: prefill.meta,
        cards: prefill.cards,
        exercises,
        cardless: prefill.cards.length === 0,
        migratedCount,
        origin: (entry?.domain as UserLessonOrigin) ?? "imported",
        originalSteps: lesson.steps,
        lessonId: lesson.id,
        snapshot: editSnapshot(prefill.meta, prefill.cards, exercises),
    };
}

/**
 * Resolve which lesson of a set the edit wizard should open on (#2210).
 *
 * A per-row Edit passes the lesson's ``{id}.json`` filename (or the bare id,
 * as folded rows carry it) via the edit route's ``?lesson=`` hint, so the
 * wizard lands on THAT lesson instead of always the first. The hint is matched
 * tolerantly against the lesson id with an optional ``.json`` suffix. An
 * absent, empty, or unknown hint resolves to 0 - the historical "open the
 * first lesson" behavior, so an entry that carries no lesson is unchanged.
 */
export function resolveEditLessonIndex(
    lessons: readonly ContentLesson[],
    lessonParam?: string | null,
): number {
    if (!lessonParam) return 0;
    const wanted = lessonParam.replace(/\.json$/, "");
    const index = lessons.findIndex((lesson) => lesson.id === wanted);
    return index === -1 ? 0 : index;
}

/** A short, human label for a lesson in the picker — its title, or a
 *  1-based fallback when a lesson carries no title. */
export function lessonPickerLabel(lesson: ContentLesson, index: number): string {
    const title = lesson.title?.trim();
    return title ? title : `Lesson ${index + 1}`;
}

/** Merge the edited lesson back into the set's ``SaveUserSetInput``.
 *
 *  Single-lesson set: the base input (built from the edited lesson's meta) is
 *  already correct. Multi-lesson set: replace only the edited lesson and
 *  PRESERVE the set-level metadata (title / native title / languages / level /
 *  description) from the original catalog entry, so editing a non-first lesson
 *  never renames or re-levels the whole set (#1971). */
export function mergeEditedLessonIntoSet(
    base: SaveUserSetInput,
    ctx: {lessons: ContentLesson[]; editIndex: number; entry?: ContentSetEntry},
    editedLesson: ContentLesson,
): SaveUserSetInput {
    if (ctx.lessons.length <= 1) return base;
    const e = ctx.entry;
    return {
        ...base,
        ...(e
            ? {
                  title: e.title,
                  title_native: e.title_native ?? base.title_native,
                  language: e.language,
                  target_language: e.target_language,
                  source_language: e.source_language,
                  level: e.level,
                  description: e.description ?? base.description,
              }
            : {}),
        lessons: ctx.lessons.map((l, i) =>
            i === ctx.editIndex ? editedLesson : l,
        ),
    };
}

/** Carry the set-level ``book`` block (#769 / #1743) from the original catalog
 *  entry onto an edit-save input (#1989). ``buildUserSetInput`` — the edit path
 *  — has no ``book`` field, so without this a re-save persists ``book: null``
 *  and wipes the reference. A lesson that never had a book stays without one
 *  (the input is returned untouched; no forced empty object). */
export function withPreservedSetBook(
    input: SaveUserSetInput,
    entry: ContentSetEntry | undefined,
): SaveUserSetInput {
    return entry?.book ? {...input, book: entry.book} : input;
}
