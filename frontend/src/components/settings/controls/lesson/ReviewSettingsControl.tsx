/**
 * ReviewSettingsControl - the Settings > Learning > Review card: the
 * toggle for the auto-generated error explanations shown after a lesson
 * (#599), the review length (#718), and, as its last block, the
 * read-only spaced-repetition schedule (#2956: the SRS explanation has
 * no input of its own, so it lives inside this card instead of as a
 * card of its own between two "Review" headings). Persists via
 * lib/review/reviewPref + lib/learning/reviewLimitPref (localStorage,
 * mode-agnostic).
 */

import {useState} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import FormHint from "../../../../shared/forms/FormHint";
import {SettingsSection} from "../../SettingsSection";
import SrsTransparencySection from "./SrsTransparencySection";
import {
    readExplanationsEnabled,
    setExplanationsEnabled,
} from "../../../../lib/review/reviewPref";
import {
    readReviewLimit,
    REVIEW_LIMIT_OPTIONS,
    writeReviewLimit,
} from "../../../../lib/learning/reviewLimitPref";

export default function ReviewSettingsControl() {
    const {t} = useI18n();
    const [enabled, setEnabled] = useState(() => readExplanationsEnabled());
    const [limit, setLimit] = useState(() => readReviewLimit());

    const handle = (next: boolean) => {
        setEnabled(next);
        setExplanationsEnabled(next);
    };

    const handleLimit = (next: number) => {
        setLimit(next);
        writeReviewLimit(next);
    };

    return (
        <SettingsSection
            title={t("settings.section_review", "Review")}
            testid="settings-section-review"
        >
            <label className="flex items-center justify-between gap-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[0.95rem] font-medium">
                        {t(
                            "settings.explanations_enabled",
                            "Show explanations",
                        )}
                    </span>
                    <FormHint as="span">
                        {t(
                            "settings.explanations_enabled_desc",
                            "After an answer, show the exercise's explanation; after a lesson, a short rule tip for each mistake.",
                        )}
                    </FormHint>
                </span>
                <input
                    type="checkbox"
                    className="m-0 size-4 flex-none p-0"
                    data-testid="settings-explanations-toggle"
                    checked={enabled}
                    onChange={(e) => handle(e.target.checked)}
                />
            </label>
            <label className="flex flex-col gap-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[0.95rem] font-medium">
                        {t(
                            "settings.review_limit.label",
                            "Questions per review",
                        )}
                    </span>
                    <FormHint as="span">
                        {t(
                            "settings.review_limit.desc",
                            "How many elements one review session presents before it ends. More due items roll over to the next round.",
                        )}
                    </FormHint>
                </span>
                <select
                    className="min-h-11 w-24 rounded-md border border-input bg-background px-2 text-foreground"
                    data-testid="settings-review-limit"
                    value={limit}
                    onChange={(e) => handleLimit(parseInt(e.target.value, 10))}
                >
                    {REVIEW_LIMIT_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                            {n}
                        </option>
                    ))}
                </select>
            </label>
            <SrsTransparencySection />
        </SettingsSection>
    );
}
