/**
 * FeedbackIntensityControl (EXP-008 / Phase 55E).
 *
 * Settings > Interface control for the celebration feedback
 * intensity. Three mutually-exclusive levels (subtle / normal /
 * enthusiastic), persisted in localStorage via ``feedbackPref``.
 * Changing it dispatches the pref-change event so every
 * celebration component re-reads live (no reload).
 *
 * When the OS requests reduced motion, the effective intensity is
 * forced to "subtle" regardless of this setting; a hint surfaces
 * that so the control does not look broken.
 */

import {useState} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import FormHint from "../../../../shared/forms/FormHint";
import {
    prefersReducedMotion,
    readFeedbackIntensity,
    setFeedbackIntensity,
    type FeedbackIntensity,
} from "../../../../lib/feedback/feedbackPref";

const LEVELS: FeedbackIntensity[] = ["subtle", "normal", "enthusiastic"];

const LABELS: Record<FeedbackIntensity, {label: string; desc: string}> = {
    subtle: {
        label: "Subtle",
        desc: "Only the correct/wrong colour. No phrases, confetti, or milestone overlays.",
    },
    normal: {
        label: "Normal",
        desc: "Animations, praise phrases, and confetti on a perfect score.",
    },
    enthusiastic: {
        label: "Enthusiastic",
        desc: "Everything, plus milestone overlays and praise on every correct answer.",
    },
};

export default function FeedbackIntensityControl() {
    const {t} = useI18n();
    const [intensity, setIntensity] = useState<FeedbackIntensity>(() =>
        readFeedbackIntensity(),
    );
    const reduced = prefersReducedMotion();

    const handleChange = (next: FeedbackIntensity) => {
        setIntensity(next);
        setFeedbackIntensity(next);
    };

    return (
        <fieldset
            className="form-row form-row-fieldset"
            data-testid="settings-feedback-intensity"
        >
            <legend className="form-label">
                {t("settings.feedback_intensity", "Feedback Intensity")}
            </legend>
            <FormHint as="span">
                {t(
                    "settings.feedback_intensity_description",
                    "How loudly the app celebrates your progress.",
                )}
            </FormHint>
            <div className="feedback-intensity-options">
                {LEVELS.map((level) => (
                    <label
                        key={level}
                        className="feedback-intensity-option"
                    >
                        <input
                            type="radio"
                            name="feedback-intensity"
                            value={level}
                            checked={intensity === level}
                            onChange={() => handleChange(level)}
                            data-testid={`settings-feedback-intensity-${level}`}
                        />
                        <span className="feedback-intensity-option-text">
                            <span className="form-label">
                                {t(
                                    `settings.feedback_intensity_${level}`,
                                    LABELS[level].label,
                                )}
                            </span>
                            <FormHint as="span">
                                {t(
                                    `settings.feedback_intensity_${level}_desc`,
                                    LABELS[level].desc,
                                )}
                            </FormHint>
                        </span>
                    </label>
                ))}
            </div>
            {reduced && (
                <FormHint
                    as="span"
                    data-testid="settings-feedback-intensity-reduced-hint"
                >
                    {t(
                        "settings.feedback_intensity_reduced_motion_hint",
                        "Reduced-motion is on in your system, so feedback is kept subtle regardless of this setting.",
                    )}
                </FormHint>
            )}
        </fieldset>
    );
}
