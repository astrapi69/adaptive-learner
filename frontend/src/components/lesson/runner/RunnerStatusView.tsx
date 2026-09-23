/**
 * RunnerStatusView (EXP-052 slice 0, refs #3169).
 *
 * The pre-step status screens of the runner shell: ``LessonStatusView``
 * generalised over a testid prefix and an i18n namespace, plus the
 * ``empty`` screen the four session runners render today (nothing due,
 * nothing to shuffle, nothing to adapt). For the lesson prefix the
 * markup is byte-identical to ``LessonStatusView`` (pinned by test);
 * the four ``render*Status`` page copies are replaced slice by slice.
 *
 * Keys are read as ``{namespace}.{suffix}``; the fallbacks carry the
 * lesson wording. A namespace that lacks a suffix (today
 * ``error.invalid_data`` outside ``lesson``) shows the fallback until
 * its catalog PR lands (#2578 order: catalog first, then the page
 * slice). The content-browser exit reads the shared
 * ``lesson.action.open_browser`` every page already uses; the dashboard
 * exit of the empty screen is the route all four session pages use.
 *
 * @example
 * const kind = resolveRunnerStatusKind(Boolean(setId), source.status);
 * if (kind) {
 *   return (
 *     <RunnerStatusView
 *       testIdPrefix="review"
 *       i18nNamespace="review"
 *       kind={kind}
 *       error={source.error}
 *     />
 *   );
 * }
 */

import { ArrowLeft, Download } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { useDevMode } from "../../../hooks/settings/useDevMode";
import { useI18n } from "../../../hooks/ui/useI18n";
import type { RunnerSourceStatus, RunnerTestIdPrefix } from "./types";

export type RunnerStatusKind = "missing" | "loading" | "empty" | "not-cached" | "error";

/**
 * The status screen the shell shows before the step view, or ``null``
 * once the source is ready. Missing route params win over the source
 * status, exactly as the pages resolve it today.
 */
export function resolveRunnerStatusKind(
  hasParams: boolean,
  status: RunnerSourceStatus,
): RunnerStatusKind | null {
  if (!hasParams) return "missing";
  return status === "ready" ? null : status;
}

export interface RunnerStatusViewProps {
  testIdPrefix: RunnerTestIdPrefix;
  i18nNamespace: string;
  kind: RunnerStatusKind;
  error: string | null;
}

const MAIN_CLASS = "page lesson-page flex flex-col min-h-full";
const CONTENT_BROWSER_ROUTE = "/content?tab=my";
const DASHBOARD_ROUTE = "/dashboard";

/** Renders the missing / loading / empty / not-cached / error status screen. */
export default function RunnerStatusView({
  testIdPrefix,
  i18nNamespace,
  kind,
  error,
}: RunnerStatusViewProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const devMode = useDevMode();
  const testId = (suffix: string) => `${testIdPrefix}-${suffix}`;
  const pageTitle = t(`${i18nNamespace}.page_title`, "Lesson");
  const openBrowser = t("lesson.action.open_browser", "Open content browser");

  if (kind === "missing") {
    return (
      <main id="main" className={MAIN_CLASS} data-testid={testId("missing-params")}>
        <h1>{pageTitle}</h1>
        <p>
          {t(
            `${i18nNamespace}.error.missing_params`,
            "No lesson selected. Browse content sets to pick one.",
          )}
        </p>
        <Button asChild variant="default">
          <Link to={CONTENT_BROWSER_ROUTE}>{openBrowser}</Link>
        </Button>
      </main>
    );
  }

  if (kind === "loading") {
    return (
      <main id="main" className={MAIN_CLASS} data-testid={testId("loading")}>
        <p>{t(`${i18nNamespace}.loading`, "Loading lesson…")}</p>
      </main>
    );
  }

  if (kind === "empty") {
    return (
      <main id="main" className={MAIN_CLASS} data-testid={testId("empty")}>
        <header className="lesson-header">
          <h1>{pageTitle}</h1>
        </header>
        <p className="lesson-not-cached-body">
          {t(`${i18nNamespace}.empty_body`, "Nothing to practise in this set right now.")}
        </p>
        <p>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(DASHBOARD_ROUTE)}
            data-testid={testId("back-to-dashboard")}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {t(`${i18nNamespace}.back_to_dashboard`, "Back to Dashboard")}
          </Button>
        </p>
      </main>
    );
  }

  if (kind === "not-cached") {
    return (
      <main id="main" className={MAIN_CLASS} data-testid={testId("not-cached")}>
        <header className="lesson-header">
          <h1>{pageTitle}</h1>
        </header>
        <p className="lesson-not-cached-body">
          {t(
            `${i18nNamespace}.not_cached_body`,
            "This lesson isn't downloaded yet. Open the content browser and download the set first.",
          )}
        </p>
        <p>
          <Button
            type="button"
            onClick={() => navigate(CONTENT_BROWSER_ROUTE)}
            data-testid={testId("goto-content")}
          >
            <Download size={14} aria-hidden="true" />
            {openBrowser}
          </Button>
        </p>
      </main>
    );
  }

  // #1824: the raw underlying error is diagnostic detail, not user copy;
  // only Dev Mode appends it (the DEV-MODE-FRIENDLY-ERRORS-01 posture).
  const loadFailed = t(`${i18nNamespace}.error.load_failed`, "Could not load lesson.");
  const invalidData = t(
    `${i18nNamespace}.error.invalid_data`,
    "This lesson can't be opened because it contains invalid or corrupted data. Please contact the content author.",
  );
  return (
    <main id="main" className={MAIN_CLASS} data-testid={testId("error")}>
      <p>{devMode ? `${loadFailed}${error ? ` (${error})` : ""}` : invalidData}</p>
      <Button type="button" onClick={() => navigate(CONTENT_BROWSER_ROUTE)}>
        {openBrowser}
      </Button>
    </main>
  );
}
