/**
 * CreateLessonHeader — the wizard's page heading + step indicator.
 *
 * Extracted from ``CreateLesson`` for the file-size gate (#2769 pushed
 * the page over the 950-line cohesion ceiling; the header is the most
 * self-contained slice). Behaviour unchanged: "Edit lesson" when
 * reopening an existing lesson, otherwise "Create a lesson"; the step
 * indicator hides while an edit session is loading or failed.
 *
 * @example
 * <CreateLessonHeader editMode={editMode} showStep={!editLoading}
 *   step={step} totalSteps={totalSteps} />
 */

import {useI18n} from "../../hooks/ui/useI18n";

export interface CreateLessonHeaderProps {
    /** True when the wizard edits an existing own lesson (#1740). */
    editMode: boolean;
    /** Render the "Step x of y" line (hidden while edit-loading/-failed). */
    showStep: boolean;
    /** 1-based current wizard step. */
    step: number;
    /** Total steps of the active flow (compact flows have fewer). */
    totalSteps: number;
}

/**
 * Render the create/edit heading with the optional step indicator.
 *
 * @param props - See {@link CreateLessonHeaderProps}.
 */
export default function CreateLessonHeader({
    editMode,
    showStep,
    step,
    totalSteps,
}: CreateLessonHeaderProps) {
    const {t} = useI18n();
    return (
        <header className="create-lesson-header mb-6 flex flex-col gap-1">
            <h1>
                {editMode
                    ? t("create_lesson.edit_title", "Edit lesson")
                    : t("create_lesson.title", "Create a lesson")}
            </h1>
            {showStep && (
                <p
                    className="create-lesson-step-indicator text-sm text-fg-muted"
                    data-testid="create-lesson-step-indicator"
                >
                    {t("create_lesson.step_of", "Step {current} of {total}")
                        .replace("{current}", String(step))
                        .replace("{total}", String(totalSteps))}
                </p>
            )}
        </header>
    );
}
