/**
 * Non-blocking notice shown when opening a legacy lesson for edit whose
 * hardcoded-English exercise prompts were auto-migrated to the UI language
 * (#1860). Renders nothing when nothing was migrated, so the page can mount
 * it unconditionally (keeps the migration guard out of the page component's
 * complexity). The migration lives in edit state only — it is persisted just
 * like any other edit, when the user saves.
 */

import {X} from "lucide-react";

type Translate = (key: string, fallback?: string) => string;

interface PromptMigrationNoticeProps {
    count: number;
    onDismiss: () => void;
    t: Translate;
}

export default function PromptMigrationNotice({
    count,
    onDismiss,
    t,
}: PromptMigrationNoticeProps) {
    if (count <= 0) return null;
    return (
        <div
            className="mb-4 flex items-start gap-3 rounded-lg border border-border bg-bg-elevated p-3 text-sm text-fg-secondary"
            role="status"
            data-testid="create-lesson-prompts-migrated"
        >
            <p className="m-0 flex-1">
                {t(
                    "create_lesson.prompts_migrated",
                    "Some exercise instructions were automatically translated to your language.",
                ).replace("{n}", String(count))}
            </p>
            <button
                type="button"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-surface hover:text-fg-primary"
                aria-label={t(
                    "create_lesson.prompts_migrated_dismiss",
                    "Dismiss",
                )}
                data-testid="create-lesson-prompts-migrated-dismiss"
                onClick={onDismiss}
            >
                <X size={14} aria-hidden="true" />
            </button>
        </div>
    );
}
