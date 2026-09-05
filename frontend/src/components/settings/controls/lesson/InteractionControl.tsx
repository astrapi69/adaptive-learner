/**
 * InteractionControl - the Settings > Learning "Interaction" section
 * (#2954, extracted verbatim from ``LearningPanel``): four in-lesson
 * interaction toggles, each localStorage-backed so the lesson consumers
 * read the same flag without a backend round-trip.
 *
 * - Swipe gestures (v1.10.0 / Phase 23E): persisted via ``gesturePref``
 *   so the consumer hooks (Assessment, Curriculum, Session) read the
 *   same flag.
 * - Lesson Enter-key shortcut (#103): the lesson player
 *   (``useLessonShortcuts``) reads the same flag.
 * - Auto-advance after a correct answer (#1330): the lesson exercise
 *   flow (``useLessonAutoAdvance``) reads the same flag. Default OFF
 *   (opt-in).
 * - "Ask AI" button visibility (#2693): ``AskAiPanel`` (via
 *   ``useAskAiVisible``) reads the same flag. Default ON.
 *
 * @example
 * <InteractionControl />
 */

import {useState} from "react";

import {useI18n} from "../../../../hooks/ui/useI18n";
import FormHint from "../../../../shared/forms/FormHint";
import {SettingsSection} from "../../SettingsSection";
import {readGesturePref, writeGesturePref} from "../../../../lib/settings/gesturePref";
import {
    readLessonShortcutsEnabled,
    setLessonShortcutsEnabled,
} from "../../../../lib/lesson/prefs/lessonShortcutsPref";
import {
    readLessonAutoAdvanceEnabled,
    setLessonAutoAdvanceEnabled,
} from "../../../../hooks/settings/useLessonAutoAdvance";
import {
    readAskAiVisible,
    setAskAiVisible,
} from "../../../../lib/lesson/prefs/askAiVisibilityPref";

export default function InteractionControl() {
    const {t} = useI18n();

    const [gesturesOn, setGesturesOn] = useState<boolean>(() => readGesturePref());

    const handleGesturesToggle = (next: boolean) => {
        setGesturesOn(next);
        writeGesturePref(next);
    };

    const [lessonShortcutsOn, setLessonShortcutsOn] = useState<boolean>(() =>
        readLessonShortcutsEnabled(),
    );

    const handleLessonShortcutsToggle = (next: boolean) => {
        setLessonShortcutsOn(next);
        setLessonShortcutsEnabled(next);
    };

    const [autoAdvanceOn, setAutoAdvanceOn] = useState<boolean>(() =>
        readLessonAutoAdvanceEnabled(),
    );

    const handleAutoAdvanceToggle = (next: boolean) => {
        setAutoAdvanceOn(next);
        setLessonAutoAdvanceEnabled(next);
    };

    const [askAiVisibleOn, setAskAiVisibleOn] = useState<boolean>(() =>
        readAskAiVisible(),
    );

    const handleAskAiVisibleToggle = (next: boolean) => {
        setAskAiVisibleOn(next);
        setAskAiVisible(next);
    };

    return (
        <SettingsSection
            title={t("settings.section_interaction", "Interaction")}
            testid="settings-section-interaction"
        >
            <label className="flex items-center justify-between gap-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[0.95rem] font-medium">{t("settings.gestures", "Swipe Gestures")}</span>
                    <FormHint as="span">
                        {t(
                            "settings.gestures_description",
                            "Swipe to navigate in Assessment, Session, and Curriculum.",
                        )}
                    </FormHint>
                </span>
                <input
                    type="checkbox"
                    className="m-0 size-4 flex-none p-0"
                    data-testid="settings-gestures-toggle"
                    checked={gesturesOn}
                    onChange={(e) => handleGesturesToggle(e.target.checked)}
                />
            </label>
            <label className="flex items-center justify-between gap-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[0.95rem] font-medium">
                        {t("settings.lesson_shortcuts", "Lesson keyboard shortcuts")}
                    </span>
                    <FormHint as="span">
                        {t(
                            "settings.lesson_shortcuts_description",
                            "Press Enter to check your answer, then Enter again to go to the next step.",
                        )}
                    </FormHint>
                </span>
                <input
                    type="checkbox"
                    className="m-0 size-4 flex-none p-0"
                    data-testid="settings-lesson-shortcuts-toggle"
                    checked={lessonShortcutsOn}
                    onChange={(e) => handleLessonShortcutsToggle(e.target.checked)}
                />
            </label>
            <label className="flex items-center justify-between gap-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[0.95rem] font-medium">
                        {t(
                            "settings.lesson_auto_advance",
                            "Auto-advance on a correct answer",
                        )}
                    </span>
                    <FormHint as="span">
                        {t(
                            "settings.lesson_auto_advance_description",
                            "After a correct answer, go to the next exercise automatically. A wrong answer always waits so you can review the solution.",
                        )}
                    </FormHint>
                </span>
                <input
                    type="checkbox"
                    className="m-0 size-4 flex-none p-0"
                    data-testid="settings-lesson-auto-advance-toggle"
                    checked={autoAdvanceOn}
                    onChange={(e) => handleAutoAdvanceToggle(e.target.checked)}
                />
            </label>
            <label className="flex items-center justify-between gap-2">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[0.95rem] font-medium">
                        {t("settings.ask_ai_visible", "Show \"Ask AI\" button")}
                    </span>
                    <FormHint as="span">
                        {t(
                            "settings.ask_ai_visible_description",
                            "Show the \"Ask AI\" button under theory and exercises. Shown by default; the button still needs your own AI key (BYOK) to answer.",
                        )}
                    </FormHint>
                </span>
                <input
                    type="checkbox"
                    className="m-0 size-4 flex-none p-0"
                    data-testid="settings-ask-ai-visible-toggle"
                    checked={askAiVisibleOn}
                    onChange={(e) => handleAskAiVisibleToggle(e.target.checked)}
                />
            </label>
        </SettingsSection>
    );
}
