import { useState } from "react";

import { useI18n } from "../../hooks/useI18n";
import {
  parseImportFile,
  type ImportedSet,
} from "../../lib/content/lesson-import";
import { getStorage } from "../../storage";
import { notify } from "../../utils/notify";

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
 */
export default function ImportLessonModal({
  open,
  onCancel,
  onImported,
}: ImportLessonModalProps) {
  const { t } = useI18n();
  const [parsed, setParsed] = useState<ImportedSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  if (!open) return null;

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setParsed(null);
    const result = await parseImportFile(file);
    if (result.ok && result.set) {
      setParsed(result.set);
    } else {
      setError(result.error ?? "invalid file");
    }
  }

  async function doImport() {
    if (!parsed) return;
    setImporting(true);
    try {
      await getStorage().contentLoader.saveUserSet({
        set_id: parsed.set_id,
        title: parsed.title,
        language: parsed.language,
        level: parsed.level,
        origin: "imported",
        description: parsed.description,
        lessons: parsed.lessons,
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
        {error && (
          <p
            className="form-hint form-hint-warning"
            data-testid="import-lesson-error"
          >
            {t("content.import_lesson.invalid", "Invalid file")}: {error}
          </p>
        )}
        {parsed && (
          <p className="form-hint" data-testid="import-lesson-preview">
            {previewText}
          </p>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="import-lesson-cancel"
            onClick={onCancel}
            disabled={importing}
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="import-lesson-confirm"
            onClick={doImport}
            disabled={importing || !parsed}
          >
            {importing
              ? t("common.loading", "Loading…")
              : t("content.import_lesson.import", "Import")}
          </button>
        </div>
      </div>
    </div>
  );
}
