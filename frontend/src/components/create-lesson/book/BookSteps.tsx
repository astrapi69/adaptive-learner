/**
 * #1743 — the book-text path's step-2 (paste/upload + generate) and step-3
 * (review + save) rendering, extracted from CreateLesson so the wizard
 * page stays under the complexity gate. Pure presentation: all state +
 * handlers arrive via props.
 *
 * #1949 — the book path now models its result as a list of generated
 * lessons ({@link GeneratedBookLesson}): the single paste path yields a
 * one-element list, the multi-select upload path yields N. The review step
 * summarises them (per-lesson titles + totals) and save persists them all
 * into one set.
 */

import {Button} from "@/components/ui/button";
import FormHint from "../../../shared/forms/FormHint";
import BookTextStep, {type BookFields} from "./BookTextStep";
import {normalizeBook} from "../../../lib/content/lesson/book-to-lesson";
import type {TheoryStep} from "../../../lib/ai/generation/exercise-generation-prompt";
import type {GeneratedBookLesson} from "../../../lib/ai/generation/generate-book-lessons";
import type {ResolvedAiProvider} from "../../../lib/ai/providers/resolve-provider";
import type {ContentLessonExercise} from "../../../storage/types";

type Translate = (key: string, fallback?: string) => string;

interface BookStepsProps {
    /** Current wizard step (2 = book text, 3 = review). */
    step: number;
    /** True once the lesson is saved (hides the review). */
    saved: boolean;
    bookText: string;
    onBookTextChange: (value: string) => void;
    book: BookFields;
    onBookChange: (patch: Partial<BookFields>) => void;
    language?: string;
    resolveProvider: () => Promise<ResolvedAiProvider | null>;
    /** Single paste path: theory + exercises for one lesson. */
    onGenerated: (
        theorySteps: TheoryStep[],
        exercises: ContentLessonExercise[],
    ) => void;
    /** #1949 — multi-select batch path: one lesson per selected section. */
    onBatchGenerated: (lessons: GeneratedBookLesson[]) => void;
    /** The generated lessons (single = 1, batch = N). */
    bookLessons: GeneratedBookLesson[];
    /** True when Next was blocked on step 2 (drives the hint, shown only
     *  while nothing has been generated yet). */
    advanceBlocked: boolean;
    saving: boolean;
    onSaveLocal: () => void;
    onSaveShare: () => void;
    t: Translate;
}

/** Renders the book-text path's step-2 and step-3 surfaces. */
export default function BookSteps({
    step,
    saved,
    bookText,
    onBookTextChange,
    book,
    onBookChange,
    language,
    resolveProvider,
    onGenerated,
    onBatchGenerated,
    bookLessons,
    advanceBlocked,
    saving,
    onSaveLocal,
    onSaveShare,
    t,
}: BookStepsProps) {
    if (step === 2) {
        const showAdvanceError = advanceBlocked && bookLessons.length === 0;
        // Single lesson generated -> show its theory/exercise counts inline;
        // a batch (>1) is summarised by BookTextStep's own batch summary.
        const single = bookLessons.length === 1 ? bookLessons[0] : null;
        return (
            <>
                <BookTextStep
                    bookText={bookText}
                    onBookTextChange={onBookTextChange}
                    book={book}
                    onBookChange={onBookChange}
                    language={language}
                    resolveProvider={resolveProvider}
                    onGenerated={onGenerated}
                    onBatchGenerated={onBatchGenerated}
                    generatedSummary={
                        single
                            ? {
                                  theory: single.theorySteps.length,
                                  exercises: single.exercises.length,
                              }
                            : null
                    }
                    t={t}
                />
                {showAdvanceError && (
                    <FormHint
                        variant="warning"
                        data-testid="create-lesson-book-error"
                        role="alert"
                    >
                        {t(
                            "create_lesson.book.generate_to_advance",
                            "Generate the lesson from your text to continue.",
                        )}
                    </FormHint>
                )}
            </>
        );
    }

    if (step === 3 && !saved) {
        const bookRef = normalizeBook(book);
        const totalTheory = bookLessons.reduce(
            (sum, l) => sum + l.theorySteps.length,
            0,
        );
        const totalExercises = bookLessons.reduce(
            (sum, l) => sum + l.exercises.length,
            0,
        );
        const multi = bookLessons.length > 1;
        return (
            <section
                className="create-lesson-step flex flex-col gap-4"
                data-testid="create-lesson-book-review"
                aria-label={t("create_lesson.review.heading", "Review & save")}
            >
                <h2 className="text-xl font-semibold text-fg-primary">
                    {t("create_lesson.review.heading", "Review & save")}
                </h2>
                <ul className="flex flex-col gap-1 text-sm text-fg-primary">
                    <li data-testid="book-review-lessons">
                        {t(
                            "create_lesson.book.review_lessons",
                            "{n} lesson(s)",
                        ).replace("{n}", String(bookLessons.length))}
                    </li>
                    <li data-testid="book-review-theory">
                        {t(
                            "create_lesson.book.review_theory",
                            "{n} theory step(s)",
                        ).replace("{n}", String(totalTheory))}
                    </li>
                    <li data-testid="book-review-exercises">
                        {t(
                            "create_lesson.book.review_exercises",
                            "{n} exercise(s)",
                        ).replace("{n}", String(totalExercises))}
                    </li>
                    {bookRef && (
                        <li data-testid="book-review-book">
                            {t(
                                "create_lesson.book.review_book",
                                "Book: {title}",
                            ).replace("{title}", bookRef.title)}
                        </li>
                    )}
                </ul>
                {multi && (
                    <ol
                        className="flex list-decimal flex-col gap-0.5 pl-6 text-sm text-fg-muted"
                        data-testid="book-review-lesson-titles"
                    >
                        {bookLessons.map((lesson, i) => (
                            <li key={`${lesson.title}-${i}`}>{lesson.title}</li>
                        ))}
                    </ol>
                )}
                <div className="form-actions">
                    <Button
                        type="button"
                        data-testid="book-save-local"
                        disabled={saving}
                        onClick={onSaveLocal}
                    >
                        {t("create_lesson.save.save_local", "Save lesson")}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        data-testid="book-save-share"
                        disabled={saving}
                        onClick={onSaveShare}
                    >
                        {t("create_lesson.save.save_share", "Save & share")}
                    </Button>
                </div>
            </section>
        );
    }

    return null;
}
