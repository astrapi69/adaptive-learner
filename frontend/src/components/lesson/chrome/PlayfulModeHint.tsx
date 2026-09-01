/**
 * Playful-mode lesson-start hint (#2844).
 *
 * A dismissible banner shown at the start of a lesson while playful
 * mode (Spielmodus) is OFF and the hint was never dismissed, so
 * learners discover the mode where it matters — right before the
 * exercises. "Turn on" enables the mode in place (and stops the
 * banner for good); the close control dismisses it permanently.
 * Renders nothing once either flag is set.
 */

import {useState} from "react";
import {Gamepad2, X} from "lucide-react";

import {useI18n} from "../../../hooks/ui/useI18n";
import {
    dismissPlayfulHint,
    readPlayfulHintDismissed,
    readPlayfulMode,
    setPlayfulMode,
} from "../../../lib/learning/playfulModePref";
import {notify} from "../../../utils/notify";

export default function PlayfulModeHint() {
    const {t} = useI18n();
    const [visible, setVisible] = useState<boolean>(
        () => !readPlayfulMode() && !readPlayfulHintDismissed(),
    );
    if (!visible) return null;

    const handleActivate = () => {
        setPlayfulMode(true);
        dismissPlayfulHint();
        setVisible(false);
        notify.success(
            t("lesson.playful_hint_activated", "Game mode is on. Have fun!"),
        );
    };

    const handleDismiss = () => {
        dismissPlayfulHint();
        setVisible(false);
    };

    return (
        <div
            role="status"
            data-testid="lesson-playful-hint"
            className="flex items-center gap-2 rounded-sm border border-[var(--accent)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--fg)]"
        >
            <Gamepad2
                size={16}
                aria-hidden="true"
                className="shrink-0 text-[var(--accent)]"
            />
            <span className="flex-1">
                <strong className="font-semibold">
                    {t("lesson.playful_hint_title", "Try game mode")}
                </strong>
                {" - "}
                {t(
                    "lesson.playful_hint_body",
                    "Lessons celebrate every correct answer with praise and confetti. You can change this any time in Settings.",
                )}
            </span>
            <button
                type="button"
                onClick={handleActivate}
                data-testid="lesson-playful-hint-activate"
                className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-[var(--accent)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface-2)]"
            >
                {t("lesson.playful_hint_activate", "Turn on")}
            </button>
            <button
                type="button"
                onClick={handleDismiss}
                data-testid="lesson-playful-hint-dismiss"
                aria-label={t("lesson.playful_hint_dismiss", "Don't show again")}
                title={t("lesson.playful_hint_dismiss", "Don't show again")}
                className="inline-flex shrink-0 items-center rounded-sm border border-[var(--border-strong)] p-1 hover:bg-[var(--surface-2)]"
            >
                <X size={12} aria-hidden="true" />
            </button>
        </div>
    );
}
