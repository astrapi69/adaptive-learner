/**
 * SrsTransparencySection — a read-only Settings → Learning panel that
 * explains how spaced repetition schedules reviews (#588).
 *
 * Shows the (non-editable) interval schedule + mastery rule straight
 * from the SRS constants in ``lib/srs/status`` (single source of truth,
 * so the explanation can't drift from the scheduler), a short
 * plain-language explanation, and a link to the learning methodology.
 */

import {useI18n} from "../hooks/ui/useI18n";
import {SRS_MASTERY_THRESHOLD, SRS_SCHEDULE} from "../lib/srs/status";

const METHODOLOGY_URL = "https://astrapi69.github.io/adaptive-learner/docs/";

export default function SrsTransparencySection() {
    const {t} = useI18n();
    return (
        <section
            className="settings-section"
            data-testid="settings-section-srs"
        >
            <h2 className="settings-section-title">
                {t("srs.settings_title", "Spaced repetition")}
            </h2>
            <p className="form-hint">
                {t(
                    "srs.settings_intro",
                    "Items you miss come back for review on a schedule that stretches as you get them right, so you practise weak spots more often than ones you know.",
                )}
            </p>
            <ul
                className="mt-2 flex flex-col gap-1"
                data-testid="srs-schedule"
            >
                {SRS_SCHEDULE.map((step) => (
                    <li
                        key={step.streak}
                        className="flex items-center justify-between gap-3 text-sm"
                    >
                        <span className="text-fg-secondary">
                            {t(
                                step.openEnded
                                    ? "srs.schedule_streak_plus"
                                    : "srs.schedule_streak",
                                step.openEnded
                                    ? "{n}+ correct in a row"
                                    : "{n} correct in a row",
                            ).replace("{n}", String(step.streak))}
                        </span>
                        <span className="tabular-nums text-fg-muted">
                            {t("srs.schedule_days", "review in {d} day(s)").replace(
                                "{d}",
                                String(step.days),
                            )}
                        </span>
                    </li>
                ))}
            </ul>
            <p className="form-hint mt-2">
                {t(
                    "srs.settings_mastery",
                    "An item counts as mastered after {n} correct answers in a row; a wrong answer resets it.",
                ).replace("{n}", String(SRS_MASTERY_THRESHOLD))}
            </p>
            <a
                href={METHODOLOGY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent underline"
                data-testid="srs-methodology-link"
            >
                {t("srs.settings_learn_more", "Learn more about the method")}
            </a>
        </section>
    );
}
