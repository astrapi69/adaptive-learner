/**
 * SetDetail — the inline Level-2 panel revealed when a SetRow is
 * expanded (feature/learning-path-redesign).
 *
 * Lists every lesson of the set (LessonRow) plus a context-aware
 * action bar: "Adaptive Lektion starten" (rule-based lesson targeting
 * this set's errors) and, when the set has active errors,
 * "Fehler wiederholen (N)" (the set-wide SRS review queue). Pure
 * presentation; navigation only. Tailwind, 44px targets.
 */

import {RefreshCw, Sparkles} from "lucide-react";
import {Link} from "react-router-dom";

import {useI18n} from "../../hooks/useI18n";
import LessonRow from "./LessonRow";
import type {PersonalPathSet} from "../../lib/learning-path/personal-path";

export interface SetDetailProps {
    set: PersonalPathSet;
}

export default function SetDetail({set}: SetDetailProps) {
    const {t} = useI18n();
    const actionClass =
        "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-app px-3 py-2 text-sm font-medium";

    return (
        <div
            className="border-t border-border px-3 pb-3 pt-1"
            data-testid={`set-detail-${set.setId}`}
        >
            <ul className="flex flex-col">
                {set.lessons.map((lesson) => (
                    <li key={lesson.filename}>
                        <LessonRow lesson={lesson} />
                    </li>
                ))}
            </ul>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Link
                    to={`/adaptive-lesson/${encodeURIComponent(set.setId)}`}
                    className={`${actionClass} bg-accent text-accent-fg`}
                    data-testid={`set-adaptive-${set.setId}`}
                >
                    <Sparkles size={16} aria-hidden="true" />
                    {t(
                        "learning_path.adaptive",
                        "Start adaptive lesson",
                    )}
                </Link>
                {set.errorCount > 0 && (
                    <Link
                        to={`/review/${encodeURIComponent(set.setId)}`}
                        className={`${actionClass} border border-border text-foreground hover:bg-muted`}
                        data-testid={`set-error-replay-${set.setId}`}
                    >
                        <RefreshCw size={16} aria-hidden="true" />
                        {t("learning_path.error_replay", "Retry errors")} (
                        {set.errorCount})
                    </Link>
                )}
            </div>
        </div>
    );
}
