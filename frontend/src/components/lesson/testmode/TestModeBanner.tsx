/**
 * Test-mode banner (#2319). Rendered while test mode is active so the state is
 * never silent - a mode in which every answer is "correct" must be visible.
 * Carries an explicit exit control. Renders nothing when test mode is off.
 */

import {FlaskConical, X} from "lucide-react";

import {useI18n} from "../../../hooks/ui/useI18n";
import {useTestMode} from "../../../hooks/lesson/modes/useTestMode";

export default function TestModeBanner() {
    const {t} = useI18n();
    const {enabled, disable} = useTestMode();
    if (!enabled) return null;
    return (
        <div
            role="status"
            aria-live="polite"
            data-testid="test-mode-banner"
            className="flex items-center gap-2 rounded-sm border border-[var(--warning)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--fg)]"
        >
            <FlaskConical
                size={16}
                aria-hidden="true"
                className="shrink-0 text-[var(--warning)]"
            />
            <span className="flex-1">
                <strong className="font-semibold">
                    {t("lesson.test_mode.title", "Test mode")}
                </strong>
                {" - "}
                {t(
                    "lesson.test_mode.description",
                    "Answers are not graded and no progress is saved.",
                )}
            </span>
            <button
                type="button"
                onClick={disable}
                data-testid="test-mode-exit"
                className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-[var(--border-strong)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)]"
            >
                <X size={12} aria-hidden="true" />
                {t("lesson.test_mode.exit", "Exit test mode")}
            </button>
        </div>
    );
}
