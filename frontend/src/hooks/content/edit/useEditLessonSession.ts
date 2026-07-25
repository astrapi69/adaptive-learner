/**
 * #1740 / #1971 — the edit-mode session of the Lesson Creator.
 *
 * Loads the set being edited (all its lessons + catalog entry), pre-fills the
 * wizard for one lesson, and — for a multi-lesson set — lets the user switch
 * which lesson to edit, guarding unsaved edits. Extracted from ``CreateLesson``
 * so the page component stays under the cohesion + complexity gates.
 *
 * The wizard's editable state (meta / cards / exercises) lives in the page; the
 * hook pushes a loaded lesson into it via the passed setters and reads the
 * live draft back through ``draftSnapshotRef`` to detect unsaved edits.
 */

import {useCallback, useEffect, useRef, useState} from "react";
import type {Dispatch, RefObject, SetStateAction} from "react";

import {
    buildEditPrefill,
    fetchEditLessonSet,
} from "../../../lib/content/lesson/edit/edit-session";
import type {
    LessonCardDraft,
    LessonMeta,
} from "../../../lib/content/lesson/lesson-draft";
import type {
    ContentLesson,
    ContentLessonExercise,
    ContentLessonStep,
    ContentSetEntry,
    UserLessonOrigin,
} from "../../../storage/types";

type Translate = (key: string, fallback?: string) => string;

/** Wizard step counts for the edit flow, mirrored from ``CreateLesson`` (the
 *  page owns the canonical constants). Edit mode is only ever the card-driven
 *  4-step flow or the cardless (book/theory) 3-step flow; a lesson switch
 *  clamps the preserved step to the target lesson's flow so a switch onto a
 *  shorter flow never lands past its last step. */
const EDIT_TOTAL_STEPS = 4;
const EDIT_TOTAL_STEPS_CARDLESS = 3;

/** The set/lesson the wizard was opened to edit (#1740). Held so a save
 *  overwrites the SAME set + lesson file (progress keyed on the filename
 *  survives), preserves the lesson's authored theory + sibling lessons, and
 *  (multi-lesson, #1971) keeps the set-level metadata from ``entry``. */
export interface EditContext {
    source: string;
    setId: string;
    origin: UserLessonOrigin;
    /** All lessons in the set (the edited one + untouched siblings). */
    lessons: ContentLesson[];
    /** Index (in ``lessons``) of the lesson being edited. */
    editIndex: number;
    /** The edited lesson's original steps (for theory preservation). */
    originalSteps: ContentLessonStep[];
    /** The edited lesson's id (== its ``lessons/{id}.json`` filename). */
    lessonId: string;
    /** The set's catalog entry, so a multi-lesson save preserves the set-level
     *  metadata (title / level / languages) instead of overwriting it. */
    entry?: ContentSetEntry;
}

/** The wizard setters the hook drives when it loads/switches a lesson. */
interface WizardSetters {
    setMeta: Dispatch<SetStateAction<LessonMeta>>;
    setCards: Dispatch<SetStateAction<LessonCardDraft[]>>;
    setExercises: Dispatch<SetStateAction<ContentLessonExercise[]>>;
    setCardlessEdit: Dispatch<SetStateAction<boolean>>;
    setStep: Dispatch<SetStateAction<number>>;
    setExerciseError: Dispatch<SetStateAction<boolean>>;
    setCardError: Dispatch<SetStateAction<boolean>>;
}

interface UseEditLessonSessionArgs extends WizardSetters {
    editMode: boolean;
    source?: string;
    setId?: string;
    t: Translate;
    /** Live snapshot of the wizard draft, to detect unsaved edits on switch. */
    draftSnapshotRef: RefObject<string>;
}

export interface EditLessonSession {
    editContext: EditContext | null;
    editLoading: boolean;
    editError: string | null;
    /** How many legacy English prompts were migrated on the last load (#1860). */
    promptsMigrated: number;
    dismissPromptsNotice: () => void;
    /** A pending multi-lesson switch (target index) awaiting confirmation of
     *  discarding unsaved edits; ``null`` when none is pending. */
    pendingLessonSwitch: number | null;
    /** Request a switch to lesson ``index`` (confirms first if the draft is
     *  dirty). No-op for the already-active lesson. */
    requestLessonSwitch: (index: number) => void;
    confirmLessonSwitch: () => void;
    cancelLessonSwitch: () => void;
}

/** Own the Lesson Creator's edit-mode load + multi-lesson switch. */
export function useEditLessonSession({
    editMode,
    source: sourceParam,
    setId: setIdParam,
    t,
    draftSnapshotRef,
    setMeta,
    setCards,
    setExercises,
    setCardlessEdit,
    setStep,
    setExerciseError,
    setCardError,
}: UseEditLessonSessionArgs): EditLessonSession {
    const [editContext, setEditContext] = useState<EditContext | null>(null);
    const [editLoading, setEditLoading] = useState(editMode);
    const [editError, setEditError] = useState<string | null>(null);
    const [promptsMigrated, setPromptsMigrated] = useState(0);
    const [pendingLessonSwitch, setPendingLessonSwitch] = useState<
        number | null
    >(null);
    const loadedSnapshotRef = useRef<string>("");

    const applyEditLesson = useCallback(
        (
            source: string,
            setId: string,
            lessons: ContentLesson[],
            index: number,
            entry: ContentSetEntry | undefined,
            /** #2061 — reset the wizard to step 1 (initial edit-load) vs preserve
             *  the current step (a picker switch within an open edit session). */
            resetStep: boolean,
        ) => {
            const p = buildEditPrefill(lessons[index], entry, t);
            setMeta(p.meta);
            setCards(p.cards);
            setExercises(p.exercises);
            // #1967 — a cardless (book/theory) lesson edits exercises directly.
            setCardlessEdit(p.cardless);
            setPromptsMigrated(p.migratedCount);
            setEditContext({
                source,
                setId,
                origin: p.origin,
                lessons,
                editIndex: index,
                originalSteps: p.originalSteps,
                lessonId: p.lessonId,
                entry,
            });
            loadedSnapshotRef.current = p.snapshot;
            if (resetStep) {
                setStep(1);
            } else {
                // #2061 — keep the user on the step they were on; only clamp when
                // the target lesson's flow (cardless=3, card=4) is shorter, so a
                // switch never leaves the wizard past the last step.
                const total = p.cardless
                    ? EDIT_TOTAL_STEPS_CARDLESS
                    : EDIT_TOTAL_STEPS;
                setStep((s) => Math.min(s, total));
            }
            setExerciseError(false);
            setCardError(false);
        },
        [
            t,
            setMeta,
            setCards,
            setExercises,
            setCardlessEdit,
            setStep,
            setExerciseError,
            setCardError,
        ],
    );

    useEffect(() => {
        if (!editMode) return;
        let cancelled = false;
        const source = decodeURIComponent(sourceParam as string);
        const setId = decodeURIComponent(setIdParam as string);
        (async () => {
            try {
                const {lessons, entry} = await fetchEditLessonSet(source, setId);
                if (cancelled) return;
                applyEditLesson(source, setId, lessons, 0, entry, true);
                setEditLoading(false);
            } catch (err) {
                if (cancelled) return;
                setEditError(err instanceof Error ? err.message : String(err));
                setEditLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
        // Load-once: `applyEditLesson`/`t` are intentionally not deps — a
        // language change must not reload from storage and clobber edits.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editMode, sourceParam, setIdParam]);

    const switchTo = useCallback(
        (index: number) => {
            if (!editContext) return;
            applyEditLesson(
                editContext.source,
                editContext.setId,
                editContext.lessons,
                index,
                editContext.entry,
                // #2061 — a picker switch preserves the current wizard step.
                false,
            );
        },
        [editContext, applyEditLesson],
    );

    const requestLessonSwitch = useCallback(
        (index: number) => {
            if (!editContext || index === editContext.editIndex) return;
            if (draftSnapshotRef.current !== loadedSnapshotRef.current) {
                setPendingLessonSwitch(index);
                return;
            }
            switchTo(index);
        },
        [editContext, draftSnapshotRef, switchTo],
    );

    const confirmLessonSwitch = useCallback(() => {
        if (pendingLessonSwitch === null) return;
        switchTo(pendingLessonSwitch);
        setPendingLessonSwitch(null);
    }, [pendingLessonSwitch, switchTo]);

    return {
        editContext,
        editLoading,
        editError,
        promptsMigrated,
        dismissPromptsNotice: () => setPromptsMigrated(0),
        pendingLessonSwitch,
        requestLessonSwitch,
        confirmLessonSwitch,
        cancelLessonSwitch: () => setPendingLessonSwitch(null),
    };
}
