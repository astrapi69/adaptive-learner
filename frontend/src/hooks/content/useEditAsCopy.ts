/**
 * EXP-046 item 3 / #2654 — "Als Kopie bearbeiten" for a downloaded
 * (read-only) set.
 *
 * The only fork path for foreign content was previously indirect (Import /
 * "Save as a copy" inside the Lesson Creator, #1740). This hook gives the
 * set row a discoverable, direct one: fork the set into a user-generated
 * copy with the SAME mechanics the existing fork paths already use
 * (``origin: "imported"``, ``nextCopySetId`` on collision), then hand the
 * new entry to the caller so it can route into the editor exactly like an
 * existing "My Lessons" set.
 *
 * Extracted from ``useContentSetActions`` (#2654) to keep that hook under
 * the file-size gate; composed back in via ``fetchSetLessons`` +
 * ``onForked`` so the two hooks never duplicate the fork mechanics.
 */

import { useState } from "react";

import { buildForkAttribution, stampVariationOf } from "../../lib/content/lesson/fork-provenance";
import { nextCopySetId } from "../../lib/content/lesson/lesson-import";
import { getStorage } from "../../storage";
import {
  USER_GENERATED_SOURCE,
  type ContentLesson,
  type ContentSetEntry,
} from "../../storage/types";
import { useI18n } from "../ui/useI18n";
import { notify } from "../../utils/notify";

interface UseEditAsCopyDeps {
  /** Fetch every lesson of a (downloaded) set, in document order. */
  fetchSetLessons: (entry: ContentSetEntry) => Promise<ContentLesson[]>;
  /** Called with the freshly-saved user-generated copy once the fork
   *  succeeds — the caller routes into the editor from here. */
  onForked: (entry: ContentSetEntry) => void;
}

export function useEditAsCopy({ fetchSetLessons, onForked }: UseEditAsCopyDeps) {
  const { t } = useI18n();
  const [editAsCopyTarget, setEditAsCopyTarget] = useState<ContentSetEntry | null>(null);
  const [editingAsCopy, setEditingAsCopy] = useState(false);

  /** Open the confirmation on the set row. The actual fork runs in
   *  ``handleConfirmEditAsCopy``. */
  const requestEditAsCopy = (entry: ContentSetEntry) => {
    setEditAsCopyTarget(entry);
  };

  /** The set ids already taken by user-generated sets, so the fork never
   *  collides with an existing one. Mirrors CreateLesson.tsx's
   *  ``listExistingUserSetIds`` (same purpose, too small to share a
   *  module for two call sites). */
  async function listExistingUserSetIds(): Promise<Set<string>> {
    try {
      const list = await getStorage().contentLoader.listSets();
      return new Set(
        list.sets.filter((s) => s.source === USER_GENERATED_SOURCE).map((s) => s.id),
      );
    } catch {
      return new Set();
    }
  }

  const handleConfirmEditAsCopy = async () => {
    const target = editAsCopyTarget;
    if (!target) return;
    setEditingAsCopy(true);
    try {
      const lessons = await fetchSetLessons(target);
      const existing = await listExistingUserSetIds();
      const setId = nextCopySetId(target.id, existing);
      // #2655 — record the fork's derivation: variation_of on every
      // lesson, and a carried-forward set-level attribution/credit.
      const entry = await getStorage().contentLoader.saveUserSet({
        set_id: setId,
        title: target.title,
        title_native: target.title_native,
        language: target.language,
        target_language: target.target_language,
        source_language: target.source_language,
        level: target.level,
        origin: "imported",
        description: target.description,
        book: target.book,
        attribution: buildForkAttribution(target.attribution, lessons),
        lessons: stampVariationOf(lessons),
      });
      setEditAsCopyTarget(null);
      notify.success(t("content.edit_as_copy.saved", "Saved as your own copy."));
      onForked(entry);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.edit_as_copy.failed", "Could not create the copy.")} ${detail}`,
      );
    } finally {
      setEditingAsCopy(false);
    }
  };

  return {
    editAsCopyTarget,
    setEditAsCopyTarget,
    editingAsCopy,
    requestEditAsCopy,
    handleConfirmEditAsCopy,
  };
}
