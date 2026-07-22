/**
 * #1743 — the book-text path's step-2 (paste + generate) and step-3
 * (review + save) rendering, extracted from CreateLesson so the wizard
 * page stays under the complexity gate. Pure presentation: all state +
 * handlers arrive via props.
 */

import {Button} from "@/components/ui/button";
import BookTextStep, {type BookFields} from "./BookTextStep";
import {normalizeBook} from "../../../lib/content/lesson/book-to-lesson";
import type {TheoryStep} from "../../../lib/ai/generation/exercise-generation-prompt";
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
    onGenerated: (
        theorySteps: TheoryStep[],
        exercises: ContentLessonExercise[],
    ) => void;
    theorySteps: TheoryStep[];
    exercises: ContentLessonExercise[];
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
    theorySteps,
    exercises,
    advanceBlocked,
    saving,
    onSaveLocal,
    onSaveShare,
    t,
}: BookStepsProps) {
    if (step === 2) {
        const showAdvanceError =
            advanceBlocked &&
            (theorySteps.length === 0 || exercises.length === 0);
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
                    generatedSummary={
                        theorySteps.length > 0
                            ? {
                                  theory: theorySteps.length,
                                  exercises: exercises.length,
                              }
                            : null
                    }
                    t={t}
                />
                {showAdvanceError && (
                    <p
                        className="form-hint form-hint-warning"
                        data-testid="create-lesson-book-error"
                        role="alert"
                    >
                        {t(
                            "create_lesson.book.generate_to_advance",
                            "Generate the lesson from your text to continue.",
                        )}
                    </p>
                )}
            </>
        );
    }

    if (step === 3 && !saved) {
        const bookRef = normalizeBook(book);
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
                    <li data-testid="book-review-theory">
                        {t(
                            "create_lesson.book.review_theory",
                            "{n} theory step(s)",
                        ).replace("{n}", String(theorySteps.length))}
                    </li>
                    <li data-testid="book-review-exercises">
                        {t(
                            "create_lesson.book.review_exercises",
                            "{n} exercise(s)",
                        ).replace("{n}", String(exercises.length))}
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
