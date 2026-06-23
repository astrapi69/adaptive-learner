/**
 * ShareResultButton — share a completed lesson's result (#1073).
 *
 * Wires the pure share-text builder + the optional PNG card generator into the
 * app-agnostic {@link ShareButton}, with a motivation-tier-aware label (a great
 * score / record / streak gets a louder CTA; a low score stays quiet but is
 * never hidden). PII-free: only the lesson title + aggregate score leave the
 * device. Shared by the lesson summary and the Dashboard "Continue learning"
 * rows.
 *
 * @example
 * <ShareResultButton result={{lessonTitle, correct, total, scorePct, stars}} />
 */

import {useI18n} from "../../hooks/ui/useI18n";
import {
    buildLessonShareText,
    shareCtaLabel,
    type LessonShareResult,
} from "../../lib/share/lesson-share";
import {renderLessonShareImage} from "../../lib/share/lesson-share-image";
import ShareButton from "../../shared/layout/ShareButton";
import {notify} from "../../utils/notify";

export interface ShareResultButtonProps {
    /** The completed-lesson result to share (PII-free). */
    result: LessonShareResult;
    /** ShareButton visual variant (the lesson summary uses a button, the
     *  dashboard rows use the icon-only form). */
    variant?: "button" | "link";
    /** Render only the share icon (dense dashboard rows). */
    iconOnly?: boolean;
    testId?: string;
}

/** Share-the-result control: builds the localized text + PNG card and hands
 *  them to the native share sheet (clipboard fallback on desktop). */
export default function ShareResultButton({
    result,
    variant = "button",
    iconOnly = false,
    testId = "share-result-button",
}: ShareResultButtonProps) {
    const {t} = useI18n();
    const {text, url} = buildLessonShareText(result, t);

    return (
        <ShareButton
            text={text}
            url={url}
            label={shareCtaLabel(result, t)}
            variant={variant}
            iconOnly={iconOnly}
            getFiles={async () => {
                const blob = await renderLessonShareImage(result, t);
                if (!blob) return null;
                return [
                    new File([blob], "lesson-result.png", {type: "image/png"}),
                ];
            }}
            onShared={(how) => {
                if (how === "copied") {
                    notify.success(
                        t("share.achievement.copied", "Copied to clipboard"),
                    );
                }
            }}
            testId={testId}
        />
    );
}
