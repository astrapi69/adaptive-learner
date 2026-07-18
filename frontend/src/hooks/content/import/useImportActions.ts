/**
 * useImportActions (#1799 — extracted from ImportDetail.tsx).
 *
 * The three conversation actions: start-or-resume the linked
 * session (Phase 36 Bug 4 / Phase 38 Bug 7 resume path), create a
 * curriculum from the analysis (Phase 36 Bug 3 duplicate guard),
 * and extract Anki cards.
 */

import { useState } from "react";

import { ApiError } from "../../../api/client";
import { getStorage } from "../../../storage";
import { readLearnerState } from "../../../lib/learning/learnerState";
import { notify } from "../../../utils/notify";
import type {
  Curriculum,
  ImportedConversationDetail,
  LearningSession,
} from "../../../types/domain";

/** i18n translate signature (key + fallback). */
type Translate = (key: string, fallback: string) => string;

/**
 * Own the session / curriculum / Anki action state + handlers.
 *
 * @example
 * const actions = useImportActions({detail, existingCurriculum,
 *     setExistingCurriculum, activeSession, setActiveSession, go, t});
 * <ImportActionBar onSession={actions.startOrResumeSession} ... />
 */
export function useImportActions({
  detail,
  existingCurriculum,
  setExistingCurriculum,
  activeSession,
  setActiveSession,
  go,
  t,
}: {
  detail: ImportedConversationDetail | null;
  existingCurriculum: Curriculum | null;
  setExistingCurriculum: (next: Curriculum) => void;
  activeSession: LearningSession | null;
  setActiveSession: (next: LearningSession) => void;
  go: (path: string) => void;
  t: Translate;
}) {
  const [creatingCurriculum, setCreatingCurriculum] = useState(false);
  const [extractingAnki, setExtractingAnki] = useState(false);
  const [startingSession, setStartingSession] = useState(false);

  async function startOrResumeSession() {
    // Phase 36 Bug 4 — if an active session already exists,
    // navigate to it. Otherwise create a new session linked
    // back to this conversation so the next return-visit
    // resumes instead of duplicating.
    if (!detail || startingSession) return;
    if (activeSession) {
      // Phase 38 Bug 7 — use ``?session=`` so Session.tsx
      // takes the resume path (fetches existing record +
      // chat history) instead of calling start() and
      // creating a new session.
      go(`/session?session=${encodeURIComponent(activeSession.id)}`);
      return;
    }
    const { projectId } = readLearnerState();
    if (!projectId) {
      // No active project — fall back to the generic
      // /session route which routes the user to onboarding.
      // Keeps the legacy behaviour for free-form learners.
      go("/session");
      return;
    }
    setStartingSession(true);
    try {
      const learnerLang = readLearnerState().language;
      const result = await getStorage().session.start({
        project_id: projectId,
        lang: learnerLang ?? "en",
        imported_conversation_id: detail.id,
      });
      // Update the local state in case the user comes back
      // before navigating away.
      setActiveSession(result.session);
      go(`/session?session=${encodeURIComponent(result.session.id)}`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail
          : t("import.session_start_error", "Could not start the session.");
      notify.error(msg, { persistent: true });
    } finally {
      setStartingSession(false);
    }
  }

  async function createCurriculumFromAnalysis() {
    if (!detail?.analysis_result || creatingCurriculum) return;
    // Phase 36 Bug 3 — if a curriculum already exists for this
    // conversation, navigate to it instead of generating a
    // duplicate. The button text already says "Go to
    // curriculum" in this state, but defence in depth: the
    // user might double-click before the state observed the
    // initial load.
    if (existingCurriculum) {
      go(`/curriculum?id=${encodeURIComponent(existingCurriculum.id)}`);
      return;
    }
    const { userId } = readLearnerState();
    if (!userId) {
      notify.error(t("import.no_user", "No active user."));
      return;
    }
    const lessons = detail.analysis_result.suggested_curriculum ?? [];
    if (lessons.length === 0) {
      notify.warning(
        t("import.no_lessons", "The analysis did not suggest any lessons."),
      );
      return;
    }
    setCreatingCurriculum(true);
    try {
      const curriculum = await getStorage().curricula.create(userId, {
        title:
          detail.analysis_result.topic ??
          detail.title ??
          t("import.default_curriculum_title", "Imported curriculum"),
        description:
          detail.analysis_result.summary ??
          t(
            "import.curriculum_description",
            "Generated from an imported conversation.",
          ),
        imported_conversation_id: detail.id,
      });
      setExistingCurriculum(curriculum);
      // Sort by priority before persisting; lower number = higher priority.
      const sorted = [...lessons].sort((a, b) => a.priority - b.priority);
      for (let i = 0; i < sorted.length; i++) {
        const lesson = sorted[i];
        await getStorage().curricula.createTopic(curriculum.id, {
          title: lesson.title,
          description: lesson.description,
          order_index: i,
        });
      }
      notify.success(
        t("import.curriculum_created", "Curriculum created from the analysis."),
      );
      go(`/curriculum?id=${encodeURIComponent(curriculum.id)}`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail
          : t("import.curriculum_error", "Could not create the curriculum.");
      notify.error(msg);
    } finally {
      setCreatingCurriculum(false);
    }
  }

  async function extractAnkiCards() {
    if (!detail) return;
    setExtractingAnki(true);
    try {
      const cards = await getStorage().anki.extractFromConversation(detail.id);
      if (cards.length === 0) {
        notify.info(t("import.anki_no_cards", "No Anki cards extracted."));
      } else {
        notify.success(
          t(
            "import.anki_extracted",
            "Extracted {n} Anki card(s). Review them on the Anki page.",
          ).replace("{n}", String(cards.length)),
        );
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail
          : t("import.anki_extract_failed", "Could not extract Anki cards.");
      notify.error(msg);
    } finally {
      setExtractingAnki(false);
    }
  }

  return {
    creatingCurriculum,
    startingSession,
    extractingAnki,
    startOrResumeSession,
    createCurriculumFromAnalysis,
    extractAnkiCards,
  };
}
