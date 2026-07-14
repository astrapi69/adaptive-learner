import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";

import {Button} from "@/components/ui/button";
import {useHasIncompleteAssessment} from "../../hooks/learning/useAssessmentProgress";
import {useI18n} from "../../hooks/ui/useI18n";
import {readLearnerState} from "../../lib/learning/learnerState";
import {getStorage} from "../../storage";

/**
 * Settings > Learning entry for the learning profile (#106).
 *
 * Offers exactly one action, matching the project's "a function that is
 * not available is not offered" rule:
 *   - an incomplete assessment exists -> "Continue" (resume),
 *   - a completed profile exists       -> "Retake" (redo),
 *   - neither                          -> "Create".
 *
 * The completed-profile check is async (``assessment.profile`` 404s
 * when not taken); the control renders nothing until it resolves so the
 * label never flashes from "Create" to "Retake".
 */
export default function LearningProfileControl() {
    const {t} = useI18n();
    const navigate = useNavigate();
    const projectId = readLearnerState().projectId;
    const incomplete = useHasIncompleteAssessment(projectId);
    const [hasProfile, setHasProfile] = useState<boolean | null>(null);

    useEffect(() => {
        if (!projectId) {
            setHasProfile(false);
            return;
        }
        let cancelled = false;
        getStorage()
            .assessment.profile(projectId)
            .then(() => {
                if (!cancelled) setHasProfile(true);
            })
            .catch(() => {
                if (!cancelled) setHasProfile(false);
            });
        return () => {
            cancelled = true;
        };
    }, [projectId]);

    if (hasProfile === null) return null;

    const {label, hint, testid} = incomplete
        ? {
              label: t("settings.profile_resume", "Continue learning profile"),
              hint: t(
                  "settings.profile_incomplete_hint",
                  "You have an unfinished assessment.",
              ),
              testid: "settings-profile-resume",
          }
        : hasProfile
          ? {
                label: t("settings.profile_redo", "Retake learning profile"),
                hint: t(
                    "settings.profile_redo_hint",
                    "Retake the assessment to update your learning profile.",
                ),
                testid: "settings-profile-redo",
            }
          : {
                label: t("settings.profile_create", "Create learning profile"),
                hint: t(
                    "settings.profile_create_hint",
                    "Take a short assessment to get a personalised learning profile.",
                ),
                testid: "settings-profile-create",
            };

    return (
        <section
            className="settings-section"
            data-testid="settings-section-learning-profile"
        >
            <h2 className="settings-section-title">
                {t("settings.profile_title", "Learning profile")}
            </h2>
            <p className="form-hint">{hint}</p>
            <Button
                type="button"
                data-testid={testid}
                onClick={() => navigate("/assessment")}
            >
                {label}
            </Button>
        </section>
    );
}
