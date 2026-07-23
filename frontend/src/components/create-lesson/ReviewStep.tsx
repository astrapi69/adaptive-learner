/**
 * Step 4 of the Lesson Creator wizard (Phase 65D): review summary +
 * the quality checklist + the Save / Save-and-share actions. Extracted
 * from CreateLesson for the complexity burn-down (#400). Pure
 * presentation; state + actions come via props.
 */

import {Copy, Download, Save, Share2} from "lucide-react";

import {Button} from "@/components/ui/button";
import FormHint from "../../shared/forms/FormHint";
import type {DraftValidationChecks} from "../../lib/content/lesson/draft-to-lesson";
import type {LessonCardDraft, LessonMeta} from "../../lib/content/lesson/lesson-draft";
import type {ContentLessonExercise} from "../../storage/types";

type Translate = (key: string, fallback?: string) => string;

const CHECK_ROWS: Array<
    [Exclude<keyof DraftValidationChecks, "schemaError">, string]
> = [
    ["hasTitle", "Has a title"],
    // #1929 — the "language pair is valid" row is rendered again. It now
    // means "both sides are supported language codes" (a same-language
    // knowledge-domain pair is VALID, #1715), not the removed
    // ``source !== target`` gate.
    ["languagePair", "Language pair is valid"],
    ["enoughCards", "At least 4 cards"],
    ["enoughExercises", "At least 5 exercises"],
    ["enoughTypes", "At least 2 exercise types"],
    ["schemaValid", "Valid lesson structure"],
];

/** The create-time count minimums — relaxed when editing an existing lesson
 *  (#1970), which is already-valid at whatever size it was saved. */
const COUNT_CHECK_KEYS: ReadonlyArray<keyof DraftValidationChecks> = [
    "enoughCards",
    "enoughExercises",
    "enoughTypes",
];

interface ReviewStepProps {
    meta: LessonMeta;
    cards: LessonCardDraft[];
    exercises: ContentLessonExercise[];
    draftChecks: DraftValidationChecks;
    saving: boolean;
    /** #1740 — editing an existing lesson: the primary action overwrites
     *  it and a "Save as a copy" action appears instead of "Save and
     *  share". */
    editMode?: boolean;
    /** #1967 — a cardless (theory/exercise) lesson, e.g. one authored via
     *  the book-text path. A book lesson legitimately has no vocabulary
     *  cards, so the "At least 4 cards" requirement + summary row are
     *  dropped and never gate the save. */
    cardless?: boolean;
    onSaveLocal: () => void;
    onSaveShare: () => void;
    /** #1740 — save the edited lesson as a new copy (edit mode only). */
    onSaveCopy?: () => void;
    t: Translate;
}

/** The review-and-save step (wizard step 4). */
export default function ReviewStep({
    meta,
    cards,
    exercises,
    draftChecks,
    saving,
    editMode = false,
    cardless = false,
    onSaveLocal,
    onSaveShare,
    onSaveCopy,
    t,
}: ReviewStepProps) {
    // The create-time count minimums (#1967 cards; #1970 exercises + types)
    // are guidance for a NEW lesson, not requirements for re-saving an existing
    // one. Editing drops all three; a cardless CREATE drops only the card row.
    // Title / language pair / schema validity always apply.
    const rows = CHECK_ROWS.filter(([key]) => {
        if (editMode && COUNT_CHECK_KEYS.includes(key)) return false;
        if (cardless && key === "enoughCards") return false;
        return true;
    });
    const canSave =
        rows.every(([key]) => draftChecks[key]) && !saving;
    return (
        <section
            className="create-lesson-step flex flex-col gap-6"
            data-testid="create-lesson-step-4"
            aria-label={t("create_lesson.review.heading", "Review and save")}
        >
            <h2 className="text-xl font-semibold text-fg-primary">
                {t("create_lesson.review.heading", "Review and save")}
            </h2>
            <ul
                className="create-lesson-summary flex list-none flex-col gap-1 rounded-lg border border-border bg-card p-4"
                data-testid="create-lesson-summary"
            >
                <li>
                    {t("create_lesson.review.title", "Title")}:{" "}
                    <strong>{meta.title}</strong>
                </li>
                <li>
                    {t("create_lesson.review.pair", "Languages")}:{" "}
                    {meta.sourceLanguage} → {meta.targetLanguage} · {meta.level}
                </li>
                {!cardless && (
                    <li>
                        {t("create_lesson.review.cards", "Cards")}:{" "}
                        {cards.length}
                    </li>
                )}
                <li>
                    {t("create_lesson.review.exercises", "Exercises")}:{" "}
                    {exercises.length}
                </li>
            </ul>
            <ul
                className="create-lesson-checklist flex list-none flex-col gap-1 p-0"
                data-testid="create-lesson-checklist"
            >
                {rows.map(([key, fallback]) => {
                    const pass = draftChecks[key];
                    // #1722 — a bare ✗ on the structure check is not
                    // actionable; show the validator's concrete reason
                    // (e.g. which card/field violates which rule).
                    const detail =
                        key === "schemaValid" && !pass
                            ? draftChecks.schemaError
                            : null;
                    return (
                        <li
                            key={key}
                            data-testid={`check-${key}`}
                            data-pass={pass ? "true" : "false"}
                            className={
                                "flex flex-col gap-0.5 " +
                                (pass
                                    ? "check-pass text-[var(--success)]"
                                    : "check-fail text-[var(--error)]")
                            }
                        >
                            {pass ? "✓" : "✗"}{" "}
                            {t(`create_lesson.review.check_${key}`, fallback)}
                            {detail && (
                                <div
                                    className="text-sm text-muted-foreground"
                                    data-testid="check-schemaValid-detail"
                                >
                                    {t(
                                        "create_lesson.review.structure_error",
                                        "Details",
                                    )}
                                    : <code>{detail}</code>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
            {editMode && (
                <FormHint data-testid="create-lesson-edit-note">
                    {t(
                        "create_lesson.edit_note",
                        "Editing an existing lesson. Saving overwrites it; use 'Save as a copy' to keep the original.",
                    )}
                </FormHint>
            )}
            <div className="form-actions">
                <Button
                    type="button"
                    data-testid="create-lesson-save-local"
                    disabled={!canSave}
                    onClick={onSaveLocal}
                >
                    {editMode ? (
                        <Save className="h-5 w-5" aria-hidden="true" />
                    ) : (
                        <Download className="h-5 w-5" aria-hidden="true" />
                    )}
                    {saving
                        ? t("common.loading", "Loading…")
                        : editMode
                          ? t("create_lesson.save.save_changes", "Save changes")
                          : t("create_lesson.save.save_local", "Save locally")}
                </Button>
                {editMode ? (
                    <Button
                        type="button"
                        variant="secondary"
                        data-testid="create-lesson-save-copy"
                        disabled={!canSave}
                        onClick={onSaveCopy}
                    >
                        <Copy className="h-5 w-5" aria-hidden="true" />
                        {t("create_lesson.save.save_copy", "Save as a copy")}
                    </Button>
                ) : (
                    <Button
                        type="button"
                        variant="secondary"
                        data-testid="create-lesson-save-share"
                        disabled={!canSave}
                        onClick={onSaveShare}
                    >
                        <Share2 className="h-5 w-5" aria-hidden="true" />
                        {t("create_lesson.save.save_share", "Save and share")}
                    </Button>
                )}
            </div>
        </section>
    );
}
