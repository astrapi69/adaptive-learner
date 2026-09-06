import { useRef } from "react";
import type { CSSProperties } from "react";

import FeedbackIntensityControl from "../../../../components/settings/controls/motivation/FeedbackIntensityControl";
import DirectionStrategyControl from "../../../../components/settings/controls/lesson/DirectionStrategyControl";
import MatchingResolveControl from "../../../../components/settings/controls/lesson/MatchingResolveControl";
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
import { SettingsCluster } from "../../../../components/settings/SettingsCluster";
import { SettingsSection } from "../../../../components/settings/SettingsSection";
import SettingsSubNav from "../../../../components/settings/SettingsSubNav";
import { useI18n } from "../../../../hooks/ui/useI18n";
import { isSpeechRecognitionSupported } from "../../../../lib/voice/speech-recognition";
import { isSpeechSynthesisSupported } from "../../../../lib/voice/speech-synthesis";
import { useLearningSections } from "./useLearningSections";
import { useLearningAnchorOffset } from "./useLearningAnchorOffset";

interface LearningPanelProps {
  /** Whether the Learning tab is the active tab (drives ``hidden``). */
  active: boolean;
}

/**
 * Learning tab of the Settings page: 16 cards in five labelled clusters
 * (#2956), each a ``SettingsCluster`` landmark, in the FIXED causal order
 * #1459 established (mirroring the #1451 Data-tab principle):
 *
 * 1. Basics: learning profile, source languages.
 * 2. In the lesson: lesson mode, hints, interaction, exercise direction,
 *    matching resolve effect. Hints + interaction precede direction +
 *    matching (the one relative reorder vs #1459: the two cards every
 *    learner touches come before the two most learners leave alone).
 * 3. Reading aloud and dictation: the Voice card. The whole cluster is
 *    rendered only when the browser exposes at least one Web Speech API
 *    side, the same guard the card uses inside, so an unsupported
 *    browser never shows a heading over nothing.
 * 4. After the lesson: review (which hosts the read-only SRS schedule as
 *    its last block), lesson summary sections, retry errors scope.
 * 5. Motivation and routine: game mode, feedback (intensity + sounds),
 *    daily missions, and the daily reminders LAST.
 *
 * The two rare housekeeping cards #1459 parked here (paused-lesson
 * retention, max lesson size) live on the Data tab since #2955. Cluster
 * membership, in-cluster order and the tab order are pinned by
 * Settings.test.tsx regression tests; the panel stays mounted (``hidden``
 * when inactive) so deep links and ``data-testid`` assertions keep
 * working.
 *
 * A section bar above the clusters (#2961, ``SettingsSubNav``) jumps
 * between them and mirrors ``?tab=learning&section=<id>``: the deep link
 * scrolls the cluster into view once the panel is visible (the deferred
 * loop, {@link useLearningSections}), a chip click writes the param with
 * replace-state, and the Settings shell drops the param on a tab switch.
 * The bar is sticky on ``md+`` below the app header; the measured offset
 * of both strips feeds the clusters' ``scroll-margin-top`` through the
 * ``--settings-anchor-offset`` custom property.
 *
 * @example
 * <LearningPanel active={activeTab === "learning"} />
 */
export default function LearningPanel({ active }: LearningPanelProps) {
  const { t } = useI18n();
  const speechSupported =
    isSpeechSynthesisSupported() || isSpeechRecognitionSupported();
  const subNavRef = useRef<HTMLElement>(null);
  const { stickyTop, anchorOffset } = useLearningAnchorOffset(subNavRef);
  const { sections, activeSection, openSection } = useLearningSections({
    active,
    speechSupported,
  });

  return (
    <div
      className="settings-tabpanel"
      role="tabpanel"
      hidden={!active}
      data-testid="settings-panel-learning"
      style={{ "--settings-anchor-offset": `${anchorOffset}px` } as CSSProperties}
    >
      <SettingsSubNav
        ref={subNavRef}
        items={sections.map((section) => ({
          id: section.id,
          label: t(section.labelKey, section.fallback),
        }))}
        activeId={activeSection}
        onSelect={openSection}
        ariaLabel={t("settings.learning_nav_aria", "Learning sections")}
        stickyTop={stickyTop}
      />
      <SettingsCluster
        id="basics"
        testid="settings-cluster-basics"
        title={t("settings.cluster_basics", "Basics")}
        description={t(
          "settings.cluster_basics_desc",
          "Who is learning, and in which languages.",
        )}
      >
        <LearningProfileControl />
        <SourceLanguagesControl />
      </SettingsCluster>

      <SettingsCluster
        id="lessons"
        testid="settings-cluster-lessons"
        title={t("settings.cluster_lessons", "In the lesson")}
        description={t(
          "settings.cluster_lessons_desc",
          "How exercises behave while you answer.",
        )}
      >
        <LessonModeControl />
        <HintSettingsControl />
        <InteractionControl />
        <DirectionStrategyControl />
        <MatchingResolveControl />
      </SettingsCluster>

      {speechSupported && (
        <SettingsCluster
          id="voice"
          testid="settings-cluster-voice"
          title={t("settings.cluster_voice", "Reading aloud and dictation")}
          description={t(
            "settings.cluster_voice_desc",
            "Voices, speed, microphone and pronunciation practice.",
          )}
        >
          <VoiceSettingsSection />
        </SettingsCluster>
      )}

      <SettingsCluster
        id="review"
        testid="settings-cluster-review"
        title={t("settings.cluster_review", "After the lesson")}
        description={t(
          "settings.cluster_review_desc",
          "Review sessions, the lesson summary and retrying mistakes.",
        )}
      >
        <ReviewSettingsControl />
        <SummarySectionsControl />
        <ErrorReplayScopeControl />
      </SettingsCluster>

      <SettingsCluster
        id="motivation"
        testid="settings-cluster-motivation"
        title={t("settings.cluster_motivation", "Motivation and routine")}
        description={t(
          "settings.cluster_motivation_desc",
          "Game mode, feedback, daily missions and reminders.",
        )}
      >
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
      </SettingsCluster>
    </div>
  );
}
