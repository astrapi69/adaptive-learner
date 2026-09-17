/**
 * SrsTransparencySection - the read-only block at the end of the
 * Settings > Learning > Review card that explains how spaced repetition
 * schedules reviews (#588; folded into the Review card in #2956 because
 * it has no input of its own).
 *
 * Shows the (non-editable) interval schedule + mastery rule straight
 * from the SRS constants in ``lib/srs/status`` (single source of truth,
 * so the explanation can't drift from the scheduler), a short
 * plain-language explanation, and a link to the learning methodology.
 * Rendered as a bordered sub-block with an ``<h3>`` (the card's own
 * ``<h2>`` is "Review"); the testids ``settings-section-srs``,
 * ``srs-schedule`` and ``srs-methodology-link`` are unchanged.
 */

import {useI18n} from "../../../../hooks/ui/useI18n";
import FormHint from "../../../../shared/forms/FormHint";
import {SRS_MASTERY_THRESHOLD, SRS_SCHEDULE} from "../../../../lib/srs/status";
import {docsHomeUrl} from "../../../../lib/help/help-routes";

export default function SrsTransparencySection() {
    const {t, lang} = useI18n();
    return (
        <div
            data-testid="settings-section-srs"
            className="mt-4 flex flex-col gap-2 border-t border-border pt-3"
        >
            <h3 className="m-0 text-[0.95rem] font-medium">
                {t("settings.section_srs", "Spaced repetition")}
            </h3>
            <FormHint>
                {t(
                    "srs.settings_intro",
                    "Items you miss come back for review on a schedule that stretches as you get them right, so you practise weak spots more often than ones you know.",
                )}
            </FormHint>
            <ul className="flex flex-col gap-1" data-testid="srs-schedule">
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
            <FormHint>
                {t(
                    "srs.settings_mastery",
                    "An item counts as mastered after {n} correct answers in a row; a wrong answer resets it.",
                ).replace("{n}", String(SRS_MASTERY_THRESHOLD))}
            </FormHint>
            <a
                href={docsHomeUrl(lang)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent underline"
                data-testid="srs-methodology-link"
            >
                {t("srs.settings_learn_more", "Learn more about the method")}
            </a>
        </div>
    );
}
