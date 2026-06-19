/**
 * Dashboard widget — Learning Repository
 * (v1.26.0 / Phase 42 / BL-30 commit 6).
 *
 * Compact card that links to ``/projects/{projectId}/learning-repo``.
 * Does NOT pre-fetch the repo content (no rendering happens until
 * the user actually navigates), so the Dashboard stays cheap on
 * cold load. The card just gives the user a discoverable entry
 * point + a short reminder of what the feature is.
 */

import {GitBranch} from "lucide-react";
import {Link} from "react-router-dom";

import {useI18n} from "../../hooks/ui/useI18n";

interface LearningRepoWidgetProps {
    projectId: string;
}

export default function LearningRepoWidget({projectId}: LearningRepoWidgetProps) {
    const {t} = useI18n();
    return (
        <div
            className="dashboard-card learning-repo-widget"
            data-testid="learning-repo-widget"
        >
            <h3>
                <GitBranch size={18} />
                {t("repo.widget.title", "Learning Repository")}
            </h3>
            <p>
                {t(
                    "repo.widget.subtitle",
                    "Versioned snapshot of this project's progress, notes, and roadmap.",
                )}
            </p>
            <Link
                to={`/projects/${encodeURIComponent(projectId)}/learning-repo`}
                className="learning-repo-widget-link"
                data-testid="learning-repo-widget-link"
            >
                {t("repo.widget.open", "Open repository")}
            </Link>
        </div>
    );
}
