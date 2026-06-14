/**
 * Step 4 of the Lesson Creator wizard (Phase 65D): review summary +
 * the quality checklist + the Save / Save-and-share actions. Extracted
 * from CreateLesson for the complexity burn-down (#400). Pure
 * presentation; state + actions come via props.
 */

import {Download, Share2} from "lucide-react";

import {Button} from "@/components/ui/button";
import {
    allChecksPass,
    type DraftValidationChecks,
} from "../../lib/content/draft-to-lesson";
import type {LessonCardDraft, LessonMeta} from "../../lib/content/lesson-draft";
import type {ContentLessonExercise} from "../../storage/types";

type Translate = (key: string, fallback?: string) => string;

const CHECK_ROWS: Array<[keyof DraftValidationChecks, string]> = [
    ["hasTitle", "Has a title"],
    ["languagePair", "Language pair is valid"],
    ["enoughCards", "At least 4 cards"],
    ["enoughExercises", "At least 5 exercises"],
    ["enoughTypes", "At least 2 exercise types"],
    ["schemaValid", "Valid lesson structure"],
];

interface ReviewStepProps {
    meta: LessonMeta;
    cards: LessonCardDraft[];
    exercises: ContentLessonExercise[];
    draftChecks: DraftValidationChecks;
    saving: boolean;
    onSaveLocal: () => void;
    onSaveShare: () => void;
    t: Translate;
}

/** The review-and-save step (wizard step 4). */
export default function ReviewStep({
    meta,
    cards,
    exercises,
    draftChecks,
    saving,
    onSaveLocal,
    onSaveShare,
    t,
}: ReviewStepProps) {
    const canSave = allChecksPass(draftChecks) && !saving;
    return (
        <section
            className="create-lesson-step"
            data-testid="create-lesson-step-4"
            aria-label={t("create_lesson.review.heading", "Review and save")}
        >
            <h2>{t("create_lesson.review.heading", "Review and save")}</h2>
            <ul
                className="create-lesson-summary"
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
                <li>
                    {t("create_lesson.review.cards", "Cards")}: {cards.length}
                </li>
                <li>
                    {t("create_lesson.review.exercises", "Exercises")}:{" "}
                    {exercises.length}
                </li>
            </ul>
            <ul
                className="create-lesson-checklist"
                data-testid="create-lesson-checklist"
            >
                {CHECK_ROWS.map(([key, fallback]) => {
                    const pass = draftChecks[key];
                    return (
                        <li
                            key={key}
                            data-testid={`check-${key}`}
                            data-pass={pass ? "true" : "false"}
                            className={pass ? "check-pass" : "check-fail"}
                        >
                            {pass ? "✓" : "✗"}{" "}
                            {t(`create_lesson.review.check_${key}`, fallback)}
                        </li>
                    );
                })}
            </ul>
            <div className="form-actions">
                <Button
                    type="button"
                    data-testid="create-lesson-save-local"
                    disabled={!canSave}
                    onClick={onSaveLocal}
                >
                    <Download className="h-5 w-5" aria-hidden="true" />
                    {saving
                        ? t("common.loading", "Loading…")
                        : t("create_lesson.save.save_local", "Save locally")}
                </Button>
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
            </div>
        </section>
    );
}
