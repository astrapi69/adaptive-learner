/**
 * NotebookLM section on the Progress page (Phase 32 / v1.19.0).
 *
 * Three actions + a study-questions list:
 *   1. Generate study questions (project-wide AI call)
 *   2. Download NotebookLM ZIP package (client-side assembly)
 *   3. Download Study Guide (Markdown / PDF — Markdown is the
 *      backend's response, PDF reuses the existing print-iframe
 *      pattern from Phase 16)
 *
 * Plus a filterable list of saved study questions with inline
 * delete (full edit is deferred to a future polish patch — the
 * spec wants the surface, edit-in-place is a bigger UX).
 */

import { useCallback, useEffect, useState } from "react";

import { ApiError } from "../api/client";
import ApiKeyRequiredNotice from "./ApiKeyRequiredNotice";
import { Button } from "@/components/ui/button";
import { useApiKeyStatus } from "../hooks/useApiKeyStatus";
import { useI18n } from "../hooks/useI18n";
import { buildNotebookLMPackage } from "../lib/export/notebooklm-package";
import { readLearnerState } from "../lib/learnerState";
import { getStorage } from "../storage";
import type { StudyQuestion, StudyQuestionDifficulty } from "../storage/types";
import { notify } from "../utils/notify";

interface NotebookLMSectionProps {
  projectId: string;
}

const DIFFICULTIES: StudyQuestionDifficulty[] = ["easy", "medium", "hard"];

export default function NotebookLMSection({ projectId }: NotebookLMSectionProps) {
  const { t } = useI18n();
  const [questions, setQuestions] = useState<StudyQuestion[] | null>(null);
  const [filterDifficulty, setFilterDifficulty] = useState<StudyQuestionDifficulty | "">("");
  const [generating, setGenerating] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [generatingGuide, setGeneratingGuide] = useState(false);
  const userId = readLearnerState().userId;
  const apiKey = useApiKeyStatus();
  const aiUnavailable = apiKey.ready && !apiKey.hasKey;

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const rows = await getStorage().notebooklm.listQuestions(userId, {
        projectId,
        difficulty: filterDifficulty || undefined,
      });
      setQuestions(rows);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail
          : t("notebooklm.questions_load_failed", "Could not load study questions.");
      notify.error(msg);
      setQuestions([]);
    }
  }, [userId, projectId, filterDifficulty, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const generateQuestions = async () => {
    setGenerating(true);
    try {
      const rows = await getStorage().notebooklm.generateFromProject(projectId);
      if (rows.length === 0) {
        notify.info(
          t(
            "notebooklm.no_questions_generated",
            "No study questions extracted. Try after another session or two.",
          ),
        );
      } else {
        notify.success(
          t("notebooklm.questions_generated", "Generated {n} new study question(s).").replace(
            "{n}",
            String(rows.length),
          ),
        );
        void refresh();
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail
          : t("notebooklm.generate_failed", "Could not generate study questions.");
      notify.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const removeQuestion = async (q: StudyQuestion) => {
    if (!confirm(t("notebooklm.delete_confirm", "Delete this study question?"))) return;
    try {
      await getStorage().notebooklm.deleteQuestion(q.id);
      setQuestions((prev) => (prev ? prev.filter((x) => x.id !== q.id) : prev));
    } catch (err) {
      const msg = err instanceof ApiError ? err.detail : t("common.error");
      notify.error(msg);
    }
  };

  const downloadZip = async () => {
    if (!userId) return;
    setExportingZip(true);
    try {
      const result = await buildNotebookLMPackage(userId, projectId);
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify.success(
        t("notebooklm.zip_exported", "Exported {n} file(s) to {filename}.")
          .replace("{n}", String(result.fileCount))
          .replace("{filename}", result.filename),
      );
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.detail : t("notebooklm.zip_failed", "ZIP export failed.");
      notify.error(msg);
    } finally {
      setExportingZip(false);
    }
  };

  const downloadStudyGuide = async () => {
    setGeneratingGuide(true);
    try {
      const markdown = await getStorage().notebooklm.studyGuide(projectId);
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "study-guide.md";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify.success(t("notebooklm.guide_ready", "Study guide downloaded."));
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.detail
          : t("notebooklm.guide_failed", "Could not generate the study guide.");
      notify.error(msg);
    } finally {
      setGeneratingGuide(false);
    }
  };

  return (
    <section className="dashboard-card dashboard-card-wide" data-testid="notebooklm-section">
      <h2 className="dashboard-card-title">
        {t("notebooklm.section_title", "Study materials (NotebookLM-ready)")}
      </h2>

      {aiUnavailable && (
        <ApiKeyRequiredNotice
          feature={t("ui.api_key.feature_study_questions", "to generate study questions")}
          settingsHref="/settings?tab=integrations"
        />
      )}

      <div className="notebooklm-actions">
        <Button
          type="button"
          disabled={generating || aiUnavailable}
          title={aiUnavailable ? t("ui.api_key.required", "API key required.") : undefined}
          onClick={generateQuestions}
          data-testid="notebooklm-generate-questions"
        >
          {generating
            ? t("notebooklm.generating", "Generating questions…")
            : t("notebooklm.generate_questions", "Generate study questions")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={exportingZip}
          onClick={downloadZip}
          data-testid="notebooklm-download-zip"
        >
          {exportingZip
            ? t("notebooklm.exporting_zip", "Building ZIP…")
            : t("notebooklm.download_zip", "Download NotebookLM package")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={generatingGuide || aiUnavailable}
          title={aiUnavailable ? t("ui.api_key.required", "API key required.") : undefined}
          onClick={downloadStudyGuide}
          data-testid="notebooklm-study-guide"
        >
          {generatingGuide
            ? t("notebooklm.generating_guide", "Building study guide…")
            : t("notebooklm.study_guide", "Download study guide")}
        </Button>
      </div>

      <div className="notebooklm-filter">
        <label>
          <span className="form-label">
            {t("notebooklm.filter_difficulty", "Filter by difficulty")}
          </span>
          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value as StudyQuestionDifficulty | "")}
            data-testid="notebooklm-filter-difficulty"
          >
            <option value="">{t("notebooklm.filter_all", "All")}</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      {questions === null ? (
        <p data-testid="notebooklm-loading" className="muted">
          {t("common.loading", "Loading…")}
        </p>
      ) : questions.length === 0 ? (
        <p data-testid="notebooklm-empty" className="muted">
          {t(
            "notebooklm.empty",
            "No study questions yet. Generate some from your recent sessions.",
          )}
        </p>
      ) : (
        <ul className="notebooklm-question-list" data-testid="notebooklm-question-list">
          {questions.map((q) => (
            <li
              key={q.id}
              className="notebooklm-question"
              data-testid={`notebooklm-question-${q.id}`}
            >
              <div className="notebooklm-question__meta">
                <span className={`badge badge--${q.difficulty}`}>{q.difficulty}</span>
                {q.topic && <span className="notebooklm-question__topic">{q.topic}</span>}
                <span className="notebooklm-question__type">{q.question_type}</span>
              </div>
              <p className="notebooklm-question__q">
                <strong>Q:</strong> {q.question}
              </p>
              {q.expected_answer && (
                <p className="notebooklm-question__a">
                  <strong>A:</strong> {q.expected_answer}
                </p>
              )}
              <div className="notebooklm-question__actions">
                <Button type="button" variant="destructive" onClick={() => removeQuestion(q)}>
                  {t("common.delete", "Delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
