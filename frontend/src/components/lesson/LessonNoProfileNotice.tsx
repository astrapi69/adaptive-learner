/**
 * Notice shown in a lesson when there is no learner profile (#3364).
 *
 * Without a profile nothing in the lesson is saved (the progress writes
 * need a user id), and the only hint used to be on the summary's disabled
 * "mark complete" button. The owner decision on #3364: tell the learner up
 * front and link to creating a profile; never create one automatically.
 *
 * @example
 * {!userId && <LessonNoProfileNotice />}
 */

import {UserPlus} from "lucide-react";
import {Link} from "react-router";

import {useI18n} from "../../hooks/ui/useI18n";

export default function LessonNoProfileNotice() {
    const {t} = useI18n();
    return (
        <div
            role="status"
            data-testid="lesson-no-profile-notice"
            className="flex flex-wrap items-center gap-2 rounded-sm border border-[var(--warning)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--fg-primary)]"
        >
            <span className="flex-1">
                {t(
                    "lesson.summary.mark_complete_needs_profile",
                    "Create a learner profile to save your progress",
                )}
            </span>
            <Link
                to="/onboarding"
                data-testid="lesson-no-profile-create"
                className="inline-flex shrink-0 items-center gap-1 font-medium text-[var(--accent)] underline"
            >
                <UserPlus size={14} aria-hidden="true" />
                {t("lesson.progress_io.create_profile", "Create a learner profile")}
            </Link>
        </div>
    );
}
