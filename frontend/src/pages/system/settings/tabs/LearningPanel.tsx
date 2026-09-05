import FeedbackIntensityControl from "../../../../components/settings/controls/motivation/FeedbackIntensityControl";
import DirectionStrategyControl from "../../../../components/settings/controls/lesson/DirectionStrategyControl";
import MatchingResolveControl from "../../../../components/settings/controls/lesson/MatchingResolveControl";
import SrsTransparencySection from "../../../../components/session/SrsTransparencySection";
import DailyRemindersControl from "../../../../components/settings/controls/reminders/DailyRemindersControl";
import HintSettingsControl from "../../../../components/settings/controls/lesson/HintSettingsControl";
import InteractionControl from "../../../../components/settings/controls/lesson/InteractionControl";
import LessonModeControl from "../../../../components/settings/controls/lesson/LessonModeControl";
import ReviewSettingsControl from "../../../../components/settings/controls/lesson/ReviewSettingsControl";
import SummarySectionsControl from "../../../../components/settings/controls/lesson/SummarySectionsControl";
import ErrorReplayScopeControl from "../../../../components/settings/controls/lesson/ErrorReplayScopeControl";
import LearningProfileControl from "../../../../components/assessment/LearningProfileControl";
import MissionSettingsControl from "../../../../components/settings/controls/motivation/MissionSettingsControl";
import PlayfulModeControl from "../../../../components/settings/controls/motivation/PlayfulModeControl";
import SourceLanguagesControl from "../../../../components/settings/controls/lesson/SourceLanguagesControl";
import SoundSettingsControl from "../../../../components/settings/controls/motivation/SoundSettingsControl";
import VoiceSettingsSection from "../../../../components/voice/VoiceSettingsSection";
import { SettingsSection } from "../../../../components/settings/SettingsSection";
import { useI18n } from "../../../../hooks/ui/useI18n";

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
 * (feedback + sound, missions) -> reminders LAST. The two rare
 * housekeeping cards #1459 parked here (paused-lesson retention, max
 * lesson size) are data-lifecycle settings and live on the Data tab
 * since #2955. The order is pinned by a Settings.test.tsx regression
 * test; the panel stays mounted (``hidden`` when inactive) so deep links
 * and ``data-testid`` assertions keep working.
 *
 * @example
 * <LearningPanel active={activeTab === "learning"} />
 */
export default function LearningPanel({ active }: LearningPanelProps) {
  const { t } = useI18n();

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
      <InteractionControl />
      <VoiceSettingsSection />
      <ReviewSettingsControl />
      <SrsTransparencySection />
      <SummarySectionsControl />
      <ErrorReplayScopeControl />
      <PlayfulModeControl />
      <SettingsSection
        title={t("settings.section_feedback", "Feedback")}
        testid="settings-section-feedback"
      >
        <FeedbackIntensityControl />
        <SoundSettingsControl />
      </SettingsSection>
      <MissionSettingsControl />
      <DailyRemindersControl />
    </div>
  );
}
