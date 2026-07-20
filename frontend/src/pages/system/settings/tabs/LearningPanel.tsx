import { useState } from "react";

import FeedbackIntensityControl from "../../../../components/settings/controls/motivation/FeedbackIntensityControl";
import DirectionStrategyControl from "../../../../components/settings/controls/lesson/DirectionStrategyControl";
import MatchingResolveControl from "../../../../components/settings/controls/lesson/MatchingResolveControl";
import SrsTransparencySection from "../../../../components/session/SrsTransparencySection";
import DailyRemindersControl from "../../../../components/settings/controls/reminders/DailyRemindersControl";
import HintSettingsControl from "../../../../components/settings/controls/lesson/HintSettingsControl";
import LessonModeControl from "../../../../components/settings/controls/lesson/LessonModeControl";
import ReviewSettingsControl from "../../../../components/settings/controls/lesson/ReviewSettingsControl";
import SummarySectionsControl from "../../../../components/settings/controls/lesson/SummarySectionsControl";
import ErrorReplayScopeControl from "../../../../components/settings/controls/lesson/ErrorReplayScopeControl";
import LearningProfileControl from "../../../../components/assessment/LearningProfileControl";
import MaxLessonSizeControl from "../../../../components/settings/controls/lesson/MaxLessonSizeControl";
import PausedLessonsRetentionControl from "../../../../components/settings/controls/lesson/PausedLessonsRetentionControl";
import MissionSettingsControl from "../../../../components/settings/controls/motivation/MissionSettingsControl";
import SourceLanguagesControl from "../../../../components/settings/controls/lesson/SourceLanguagesControl";
import SoundSettingsControl from "../../../../components/settings/controls/motivation/SoundSettingsControl";
import VoiceSettingsSection from "../../../../components/voice/VoiceSettingsSection";
import { useI18n } from "../../../../hooks/ui/useI18n";
import FormHint from "../../../../shared/forms/FormHint";
import { readGesturePref, writeGesturePref } from "../../../../lib/settings/gesturePref";
import {
  readLessonShortcutsEnabled,
  setLessonShortcutsEnabled,
} from "../../../../lib/lesson/lessonShortcutsPref";
import {
  readLessonAutoAdvanceEnabled,
  setLessonAutoAdvanceEnabled,
} from "../../../../hooks/settings/useLessonAutoAdvance";

interface LearningPanelProps {
  /** Whether the Learning tab is the active tab (drives ``hidden``). */
  active: boolean;
}

/**
 * Learning tab of the Settings page. The sections follow a FIXED causal
 * order (#1459, mirroring the #1451 Data-tab principle): foundation
 * (learning profile, source languages) -> in-lesson flow (lesson mode,
 * direction, hints, matching effect, interaction toggles, voice) ->
 * practice & follow-up (review, SRS, lesson summary) -> motivation
 * (feedback + sound, missions) -> reminders -> rare housekeeping LAST
 * (paused-lesson retention, max lesson size). The order is pinned by a
 * Settings.test.tsx regression test; the panel stays mounted (``hidden``
 * when inactive) so deep links and ``data-testid`` assertions keep
 * working.
 *
 * @example
 * <LearningPanel active={activeTab === "learning"} />
 */
export default function LearningPanel({ active }: LearningPanelProps) {
  const { t } = useI18n();

  // v1.10.0 / Phase 23E — swipe-gesture toggle. Persisted in
  // localStorage via ``gesturePref`` so the consumer hooks
  // (Assessment, Curriculum, Session) read the same flag.
  const [gesturesOn, setGesturesOn] = useState<boolean>(() => readGesturePref());

  const handleGesturesToggle = (next: boolean) => {
    setGesturesOn(next);
    writeGesturePref(next);
  };

  // Lesson Enter-key shortcut (#103). localStorage-backed so the
  // lesson player (``useLessonShortcuts``) reads the same flag.
  const [lessonShortcutsOn, setLessonShortcutsOn] = useState<boolean>(() =>
    readLessonShortcutsEnabled(),
  );

  const handleLessonShortcutsToggle = (next: boolean) => {
    setLessonShortcutsOn(next);
    setLessonShortcutsEnabled(next);
  };

  // Auto-advance after a correct answer (#1330). localStorage-backed so the
  // lesson exercise flow (``useLessonAutoAdvance``) reads the same flag.
  // Default OFF (opt-in).
  const [autoAdvanceOn, setAutoAdvanceOn] = useState<boolean>(() =>
    readLessonAutoAdvanceEnabled(),
  );

  const handleAutoAdvanceToggle = (next: boolean) => {
    setAutoAdvanceOn(next);
    setLessonAutoAdvanceEnabled(next);
  };

  return (
    <div
      className="settings-tabpanel"
      role="tabpanel"
      hidden={!active}
      data-testid="settings-panel-learning"
    >
      <LearningProfileControl />
      <SourceLanguagesControl />
      <LessonModeControl />
      <DirectionStrategyControl />
      <HintSettingsControl />
      <MatchingResolveControl />
      <section className="settings-section" data-testid="settings-section-interaction">
        <h2 className="settings-section-title">
          {t("settings.section_interaction", "Interaction")}
        </h2>
        <label className="form-row form-row-toggle">
          <span className="form-label-stack">
            <span className="form-label">{t("settings.gestures", "Swipe Gestures")}</span>
            <FormHint as="span">
              {t(
                "settings.gestures_description",
                "Swipe to navigate in Assessment, Session, and Curriculum.",
              )}
            </FormHint>
          </span>
          <input
            type="checkbox"
            data-testid="settings-gestures-toggle"
            checked={gesturesOn}
            onChange={(e) => handleGesturesToggle(e.target.checked)}
          />
        </label>
        <label className="form-row form-row-toggle">
          <span className="form-label-stack">
            <span className="form-label">
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
            data-testid="settings-lesson-shortcuts-toggle"
            checked={lessonShortcutsOn}
            onChange={(e) => handleLessonShortcutsToggle(e.target.checked)}
          />
        </label>
        <label className="form-row form-row-toggle">
          <span className="form-label-stack">
            <span className="form-label">
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
            data-testid="settings-lesson-auto-advance-toggle"
            checked={autoAdvanceOn}
            onChange={(e) => handleAutoAdvanceToggle(e.target.checked)}
          />
        </label>
      </section>
      <VoiceSettingsSection />
      <ReviewSettingsControl />
      <SrsTransparencySection />
      <SummarySectionsControl />
      <ErrorReplayScopeControl />
      <section className="settings-section" data-testid="settings-section-feedback">
        <h2 className="settings-section-title">{t("settings.section_feedback", "Feedback")}</h2>
        <FeedbackIntensityControl />
        <SoundSettingsControl />
      </section>
      <MissionSettingsControl />
      <DailyRemindersControl />
      <PausedLessonsRetentionControl />
      <MaxLessonSizeControl />
    </div>
  );
}
