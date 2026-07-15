import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "../../../hooks/ui/useI18n";
import {
  asImportedCopy,
  parseImportFile,
  type ImportedSet,
  type SkippedLesson,
} from "../../../lib/content/lesson/lesson-import";
import { getStorage } from "../../../storage";
import { USER_GENERATED_SOURCE } from "../../../storage/types";
import { notify } from "../../../utils/notify";

interface ImportLessonModalProps {
  open: boolean;
  onCancel: () => void;
  onImported: () => void;
}

/**
 * Phase 59E / v1.42.0 — import a shared lesson from a ``.json``
 * (single lesson) or ``.zip`` (content set) file. Validates against
 * the schema BEFORE import and shows a preview; on confirm it saves
 * the set under "My Lessons" with origin "imported". Closes the
 * sharing loop with 59D — no server, no account, fully offline.
 *
 * #1672 hardening: refuses oversized files, reports lessons skipped on a
 * partial set import, and — when the set id already exists locally — asks
 * the user to overwrite / import as a copy / cancel instead of silently
 * overwriting.
 */
export default function ImportLessonModal({
  open,
  onCancel,
  onImported,
}: ImportLessonModalProps) {
  const { t } = useI18n();
  const [parsed, setParsed] = useState<ImportedSet | null>(null);
  const [skipped, setSkipped] = useState<SkippedLesson[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  // #1672 — set of existing user-generated set ids when a collision is
  // detected; drives the overwrite / copy / cancel choice.
  const [collisionIds, setCollisionIds] = useState<Set<string> | null>(null);

  if (!open) return null;

  function resetParse() {
    setError(null);
    setParsed(null);
    setSkipped([]);
    setCollisionIds(null);
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    resetParse();
    const result = await parseImportFile(file);
    if (result.ok && result.set) {
      setParsed(result.set);
      setSkipped(result.skipped ?? []);
    } else {
      setError(result.error ?? "invalid file");
    }
  }

  /** Persist a resolved set (either the parsed one or a fresh copy). */
  async function persist(set: ImportedSet) {
    setImporting(true);
    try {
      await getStorage().contentLoader.saveUserSet({
        set_id: set.set_id,
        title: set.title,
        language: set.language,
        level: set.level,
        origin: "imported",
        description: set.description,
        lessons: set.lessons,
      });
      notify.success(t("content.import_lesson.imported", "Lesson imported."));
      onImported();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      notify.error(
        `${t("content.import_lesson.failed", "Could not import the lesson.")} ${detail}`,
      );
    } finally {
      setImporting(false);
    }
  }

  /** Import button: detect a name collision first, else save straight away. */
  async function doImport() {
    if (!parsed) return;
    let existingIds: Set<string>;
    try {
      const { sets } = await getStorage().contentLoader.listSets();
      existingIds = new Set(
        sets
          .filter((s) => s.source === USER_GENERATED_SOURCE)
          .map((s) => s.id),
      );
    } catch {
      // If the set list can't be read, fall through to a direct save
      // (saveUserSet overwrites by id — no worse than before).
      existingIds = new Set();
    }
    if (existingIds.has(parsed.set_id)) {
      setCollisionIds(existingIds);
      return;
    }
    await persist(parsed);
  }

  function overwrite() {
    if (!parsed) return;
    setCollisionIds(null);
    void persist(parsed);
  }

  function importAsCopy() {
    if (!parsed || !collisionIds) return;
    const copy = asImportedCopy(
      parsed,
      collisionIds,
      t("content.import_lesson.copy_suffix", "copy"),
    );
    setCollisionIds(null);
    void persist(copy);
  }

  const exerciseCount = parsed
    ? parsed.lessons.reduce(
        (n, l) => n + l.steps.filter((s) => s.type === "exercise").length,
        0,
      )
    : 0;
  const previewText = parsed
    ? t(
        "content.import_lesson.preview",
        "{title} · {lang} · {lessons} lessons · {exercises} exercises",
      )
        .replace("{title}", parsed.title)
        .replace("{lang}", parsed.language.toUpperCase())
        .replace("{lessons}", String(parsed.lessons.length))
        .replace("{exercises}", String(exerciseCount))
    : "";

  return (
    <div className="modal-overlay" data-testid="import-lesson-modal">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-lesson-title"
      >
        <h2 id="import-lesson-title" className="modal-title">
          {t("content.import_lesson.modal_title", "Import a lesson")}
        </h2>
        <label className="form-row">
          <span className="form-label">
            {t(
              "content.import_lesson.choose_file",
              "Choose a .json or .zip file",
            )}
          </span>
          <input
            type="file"
            accept=".json,.zip"
            data-testid="import-lesson-file"
            onChange={onFile}
            disabled={importing}
          />
        </label>
        {/* aria-live so screen readers announce the parse outcome. */}
        <div aria-live="polite">
          {error && (
            <p
              className="form-hint form-hint-warning"
              data-testid="import-lesson-error"
              role="alert"
            >
              {t("content.import_lesson.invalid", "Invalid file")}: {error}
            </p>
          )}
          {parsed && (
            <p className="form-hint" data-testid="import-lesson-preview">
              {previewText}
            </p>
          )}
          {skipped.length > 0 && (
            <p
              className="form-hint form-hint-warning"
              data-testid="import-lesson-skipped"
            >
              {t(
                "content.import_lesson.skipped",
                "{n} lesson(s) were skipped because they failed validation.",
              ).replace("{n}", String(skipped.length))}
            </p>
          )}
        </div>
        {collisionIds ? (
          <div data-testid="import-lesson-collision">
            <p className="form-label">
              {t(
                "content.import_lesson.collision_title",
                "This lesson already exists",
              )}
            </p>
            <p className="form-hint">
              {t(
                "content.import_lesson.collision_body",
                "A saved lesson set already uses this identifier. Overwrite it, import a separate copy, or cancel?",
              )}
            </p>
            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                data-testid="import-lesson-cancel"
                onClick={() => setCollisionIds(null)}
                disabled={importing}
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                data-testid="import-lesson-copy"
                onClick={importAsCopy}
                disabled={importing}
              >
                {t("content.import_lesson.copy", "Import as copy")}
              </Button>
              <Button
                type="button"
                data-testid="import-lesson-overwrite"
                onClick={overwrite}
                disabled={importing}
              >
                {t("content.import_lesson.overwrite", "Overwrite")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              data-testid="import-lesson-cancel"
              onClick={onCancel}
              disabled={importing}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="button"
              data-testid="import-lesson-confirm"
              onClick={doImport}
              disabled={importing || !parsed}
            >
              {importing
                ? t("common.loading", "Loading…")
                : t("content.import_lesson.import", "Import")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
