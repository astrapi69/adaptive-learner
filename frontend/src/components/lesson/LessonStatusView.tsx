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
import type { ContentLesson } from "../../storage/types";
import type { LessonLoadStatus } from "../../hooks/useLesson";
import { useI18n } from "../../hooks/useI18n";

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
          <Link to="/content">
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
            onClick={() => navigate("/content")}
            data-testid="lesson-goto-content"
          >
            <Download size={14} aria-hidden="true" />
            {t("lesson.action.open_browser", "Open content browser")}
          </Button>
        </p>
      </main>
    );
  }

  return (
    <main id="main" className={MAIN_CLASS} data-testid="lesson-error">
      <p>
        {t("lesson.error.load_failed", "Could not load lesson.")}
        {error ? ` (${error})` : ""}
      </p>
      <Button type="button" onClick={() => navigate("/content")}>
        {t("lesson.action.open_browser", "Open content browser")}
      </Button>
    </main>
  );
}
