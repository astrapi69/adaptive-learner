/**
 * The post-save success panel + the wizard navigation bar of the Lesson
 * Creator, extracted from CreateLesson so the page module stays under the
 * cohesion size gate (#1967). Pure presentation: all state + callbacks arrive
 * via props; the same ``data-testid``s render, so behaviour is unchanged.
 */

import {Download} from "lucide-react";

import {Button} from "@/components/ui/button";

type Translate = (key: string, fallback?: string) => string;

interface SavedLessonActionsProps {
    onPlay: () => void;
    onExport: () => void;
    onCreateAnother: () => void;
    onToBrowser: () => void;
    t: Translate;
}

/** The "Lesson saved!" panel shown once a lesson is persisted. */
export function SavedLessonActions({
    onPlay,
    onExport,
    onCreateAnother,
    onToBrowser,
    t,
}: SavedLessonActionsProps) {
    return (
        <section
            className="create-lesson-step flex flex-col gap-4"
            data-testid="create-lesson-saved"
        >
            <h2 className="text-xl font-semibold text-fg-primary">
                {t("create_lesson.save.saved", "Lesson saved!")}
            </h2>
            <div className="form-actions">
                <Button type="button" data-testid="create-lesson-play" onClick={onPlay}>
                    {t("create_lesson.save.play", "Play lesson")}
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    data-testid="create-lesson-save-file"
                    onClick={onExport}
                >
                    <Download className="h-5 w-5" aria-hidden="true" />
                    {t("create_lesson.save.save_file", "Save as file")}
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    data-testid="create-lesson-create-another"
                    onClick={onCreateAnother}
                >
                    {t("create_lesson.save.create_another", "Create another lesson")}
                </Button>
                <Button
                    type="button"
                    variant="secondary"
                    data-testid="create-lesson-to-browser"
                    // #1253 — "My Lessons" lives on the Import tab now, so land
                    // the just-created lesson there.
                    onClick={onToBrowser}
                >
                    {t("create_lesson.save.to_browser", "To Content Browser")}
                </Button>
            </div>
        </section>
    );
}

interface WizardNavProps {
    step: number;
    totalSteps: number;
    onCancel: () => void;
    onBack: () => void;
    onNext: () => void;
    t: Translate;
}

/** The Cancel / Back / Next navigation bar shown while authoring. */
export function WizardNav({
    step,
    totalSteps,
    onCancel,
    onBack,
    onNext,
    t,
}: WizardNavProps) {
    return (
        <nav
            className="create-lesson-nav mt-6 flex flex-wrap items-center justify-end gap-3"
            aria-label={t("create_lesson.nav_label", "Wizard navigation")}
        >
            <Button
                type="button"
                variant="outline"
                data-testid="create-lesson-cancel"
                onClick={onCancel}
            >
                {t("create_lesson.cancel", "Cancel")}
            </Button>
            {step > 1 && (
                <Button
                    type="button"
                    variant="outline"
                    data-testid="create-lesson-back"
                    onClick={onBack}
                >
                    {t("create_lesson.back", "Back")}
                </Button>
            )}
            {step < totalSteps && (
                <Button
                    type="button"
                    data-testid="create-lesson-next"
                    onClick={onNext}
                >
                    {t("create_lesson.next", "Next")}
                </Button>
            )}
        </nav>
    );
}
