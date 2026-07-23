/**
 * The pre-step status screens of the lesson viewer (extracted from
 * LessonPage for the complexity burn-down #417).
 *
 * Collapses the four early-return guards — missing URL params, loading,
 * not-cached, and load-error — into one component plus a pure resolver,
 * so LessonPage carries a single guard instead of four. Behaviour and
 * markup (data-testids, copy, actions) are preserved verbatim.
 */

import { Download } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import type { ContentLesson } from "../../../storage/types";
import type { LessonLoadStatus } from "../../../hooks/lesson/session/useLesson";
import { useI18n } from "../../../hooks/ui/useI18n";
import { useDevMode } from "../../../hooks/settings/useDevMode";

export type LessonStatusKind = "missing" | "loading" | "not-cached" | "error";

/**
 * The status screen the viewer should show before the step view, or
 * ``null`` when the lesson is ready to render.
 */
export function resolveLessonStatusKind(
  source: string,
  setId: string,
  filename: string,
  status: LessonLoadStatus,
  lesson: ContentLesson | null,
): LessonStatusKind | null {
  if (!source || !setId || !filename) return "missing";
  if (status === "loading") return "loading";
  if (status === "not-cached") return "not-cached";
  if (status === "error" || lesson === null) return "error";
  return null;
}

interface LessonStatusViewProps {
  kind: LessonStatusKind;
  error: string | null;
}

const MAIN_CLASS = "page lesson-page flex flex-col min-h-full";

/** Renders the missing / loading / not-cached / error status screen. */
export default function LessonStatusView({
  kind,
  error,
}: LessonStatusViewProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const devMode = useDevMode();

  if (kind === "missing") {
    return (
      <main id="main" className={MAIN_CLASS} data-testid="lesson-missing-params">
        <h1>{t("lesson.page_title", "Lesson")}</h1>
        <p>
          {t(
            "lesson.error.missing_params",
            "No lesson selected. Browse content sets to pick one.",
          )}
        </p>
        <Button asChild variant="default">
          <Link to="/content?tab=my">
            {t("lesson.action.open_browser", "Open content browser")}
          </Link>
        </Button>
      </main>
    );
  }

  if (kind === "loading") {
    return (
      <main id="main" className={MAIN_CLASS} data-testid="lesson-loading">
        <p>{t("lesson.loading", "Loading lesson…")}</p>
      </main>
    );
  }

  if (kind === "not-cached") {
    return (
      <main id="main" className={MAIN_CLASS} data-testid="lesson-not-cached">
        <header className="lesson-header">
          <h1>{t("lesson.page_title", "Lesson")}</h1>
        </header>
        <p className="lesson-not-cached-body">
          {t(
            "lesson.not_cached_body",
            "This lesson isn't downloaded yet. Open the content browser and download the set first.",
          )}
        </p>
        <p>
          <Button
            type="button"
            onClick={() => navigate("/content?tab=my")}
            data-testid="lesson-goto-content"
          >
            <Download size={14} aria-hidden="true" />
            {t("lesson.action.open_browser", "Open content browser")}
          </Button>
        </p>
      </main>
    );
  }

  // #1824 — the raw underlying error (a Pydantic validation dump in
  // API mode, a raw thrown message in Dexie mode) is diagnostic detail,
  // not user copy. Outside Developer Mode show a friendly, actionable
  // message; only in Dev Mode append the raw detail (matching the
  // DEV-MODE-FRIENDLY-ERRORS-01 posture used by the toast layer).
  return (
    <main id="main" className={MAIN_CLASS} data-testid="lesson-error">
      <p>
        {devMode
          ? `${t("lesson.error.load_failed", "Could not load lesson.")}${
              error ? ` (${error})` : ""
            }`
          : t(
              "lesson.error.invalid_data",
              "This lesson can't be opened because it contains invalid or corrupted data. Please contact the content author.",
            )}
      </p>
      <Button type="button" onClick={() => navigate("/content?tab=my")}>
        {t("lesson.action.open_browser", "Open content browser")}
      </Button>
    </main>
  );
}
