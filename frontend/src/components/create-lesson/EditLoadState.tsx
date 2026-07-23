/**
 * Edit-mode load state for the Lesson Creator (#1740): a loading line
 * while the existing lesson is fetched, or an error panel with a way
 * back when it can't be loaded. Rendered unconditionally (returns null
 * in the normal new-lesson flow) so the page component keeps its two
 * guard branches out of its own cyclomatic complexity.
 */

import {Button} from "@/components/ui/button";
import FormHint from "../../shared/forms/FormHint";

type Translate = (key: string, fallback?: string) => string;

interface EditLoadStateProps {
    loading: boolean;
    error: boolean;
    onBack: () => void;
    t: Translate;
}

export default function EditLoadState({
    loading,
    error,
    onBack,
    t,
}: EditLoadStateProps) {
    if (loading) {
        return (
            <p
                className="text-sm text-fg-muted"
                role="status"
                data-testid="create-lesson-edit-loading"
            >
                {t("common.loading", "Loading…")}
            </p>
        );
    }
    if (error) {
        return (
            <section
                className="create-lesson-step flex flex-col gap-4"
                data-testid="create-lesson-edit-error"
            >
                <FormHint variant="warning" role="alert">
                    {t(
                        "create_lesson.edit_load_error",
                        "Could not load this lesson for editing.",
                    )}
                </FormHint>
                <div className="form-actions">
                    <Button
                        type="button"
                        variant="outline"
                        data-testid="create-lesson-edit-error-back"
                        onClick={onBack}
                    >
                        {t("create_lesson.back", "Back")}
                    </Button>
                </div>
            </section>
        );
    }
    return null;
}
