/**
 * Open and edit routing for set rows, split out of ``useContentSetActions``
 * (#3271): jump into a set's first lesson or a specific lesson file, and
 * route an own set into its editor.
 *
 * @example
 * const nav = useSetNavigation({ navigate });
 * await nav.handleOpenLesson(entry, { focusResources: true });
 * nav.handleEditUserSet(entry, "02.json");
 */

import type { NavigateFunction } from "react-router";

import { getStorage } from "../../../storage";
import type { ContentSetEntry } from "../../../storage/types";
import { notify } from "../../../utils/notify";
import { useI18n } from "../../ui/useI18n";

interface UseSetNavigationDeps {
  navigate: NavigateFunction;
}

/** Route slug of a content source (``owner/repo`` -> ``owner--repo``). */
const sourceSlug = (source: string): string => source.replace(/\//g, "--");

/** Navigation handlers for opening and editing sets. */
export function useSetNavigation({ navigate }: UseSetNavigationDeps) {
  const { t } = useI18n();

  /** Navigate to a specific lesson file (used by search results). */
  const openLessonFile = (source: string, id: string, filename: string) => {
    const slug = sourceSlug(source);
    navigate(
      `/lesson/${encodeURIComponent(slug)}/${encodeURIComponent(id)}/${encodeURIComponent(filename)}`,
    );
  };

  const handleOpenLesson = async (
    entry: ContentSetEntry,
    opts?: { focusResources?: boolean },
  ) => {
    // Phase 44 / EXP-002 / 3B: jump to the set's first
    // cached lesson. Future enhancements can swap this for
    // a dedicated per-set lesson list page.
    try {
      const listing = await getStorage().contentLoader.listLessons(entry.source, entry.id);
      const first = listing.lessons[0];
      if (!first) {
        notify.warning(t("content.warning.no_lessons_in_set", "This set has no lessons yet."));
        return;
      }
      const slug = sourceSlug(entry.source);
      // EXP-029 / MED-06 — a media-badge click deep-links to the
      // "Vertiefe das Thema" section (LessonResources scrolls to its
      // anchor when present).
      const hash = opts?.focusResources ? "#lesson-resources" : "";
      navigate(
        `/lesson/${encodeURIComponent(slug)}/${encodeURIComponent(entry.id)}/${encodeURIComponent(first)}${hash}`,
      );
    } catch (err) {
      notify.error(t("content.error.open_failed", "Could not open the lesson."), {
        apiError: err instanceof Error ? undefined : undefined,
      });
    }
  };

  // Edit a user-generated lesson. Analysis sets carry a recoverable
  // conversation id (``analysis-{convId}``), so they jump back to the
  // import page where re-analysing + re-saving overwrites in place
  // (Phase 59C). Every other own set (created / imported / adaptive)
  // opens the pre-filled Lesson Creator, which overwrites the same set
  // on save (#1740).
  const handleEditUserSet = (entry: ContentSetEntry, lessonFilename?: string) => {
    if (entry.domain === "analysis") {
      const convId = entry.id.replace(/^analysis-/, "");
      navigate(`/import/${encodeURIComponent(convId)}`);
      return;
    }
    // #2210 — a per-row Edit aims the wizard at one specific lesson via
    // ?lesson=; the set-level Edit (single-lesson sets) passes none and
    // keeps the historical "first lesson" landing.
    const base = `/create-lesson/edit/${encodeURIComponent(entry.source)}/${encodeURIComponent(entry.id)}`;
    navigate(
      lessonFilename ? `${base}?lesson=${encodeURIComponent(lessonFilename)}` : base,
    );
  };

  return { openLessonFile, handleOpenLesson, handleEditUserSet };
}
