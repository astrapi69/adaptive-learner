/**
 * ContentPageHeader (#1793 — extracted from Content.tsx).
 *
 * The Content-Browser page header: title, the #1272 inline info
 * button, the refresh action, and the on-demand info/sources panel
 * (#1251/#1272 — replaces the permanent intro prose + sources line;
 * the sources stay dynamic, straight from listSets()).
 */

import { RefreshCw } from "lucide-react";

import InfoHintButton from "../../../shared/feedback/InfoHintButton";
import type { useInfoHint } from "../../../shared/feedback/useInfoHint";
import { useI18n } from "../../../hooks/ui/useI18n";
import type { ContentSetSource } from "../../../storage/types";

export interface ContentPageHeaderProps {
  headerInfo: ReturnType<typeof useInfoHint>;
  sources: ContentSetSource[];
  refreshing: boolean;
  onRefresh: () => void;
}

/**
 * Render the page header + the expandable info panel.
 *
 * @example
 * <ContentPageHeader headerInfo={useInfoHint("content_my")}
 *     sources={sources} refreshing={refreshing} onRefresh={handleRefresh} />
 */
export default function ContentPageHeader({
  headerInfo,
  sources,
  refreshing,
  onRefresh,
}: ContentPageHeaderProps) {
  const { t } = useI18n();
  return (
    <>
      <header className="content-header" data-testid="content-header">
        <h1>{t("content.page_title", "Meine Inhalte")}</h1>
        {/* #1272 — the info button sits inline, right after the title;
            it reveals the intro prose + the (dynamic) sources line below
            the header on demand. */}
        <InfoHintButton
          expanded={headerInfo.expanded}
          blink={headerInfo.blink}
          label={t("ui.info.show", "Show information")}
          controls="content-info-text"
          onClick={headerInfo.toggle}
          testId="content-info-button"
          className="self-center"
        />
        <button
          type="button"
          className="content-refresh-btn ml-auto"
          onClick={onRefresh}
          disabled={refreshing}
          data-testid="content-refresh"
          aria-label={t("content.action.refresh", "Refresh")}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {refreshing
            ? t("content.action.refreshing", "Refreshing…")
            : t("content.action.refresh", "Refresh")}
        </button>
      </header>
      {/* #1251 / #1272 — the permanent intro prose AND the sources line are
          replaced by the header info button above, which expands both here
          on demand (saving vertical space). The sources stay dynamic — the
          actually-configured sources from listSets(). */}
      {headerInfo.expanded && (
        <div
          id="content-info-text"
          data-testid="content-info-text"
          className="mb-4 text-sm text-muted-foreground"
        >
          <p>
            {t(
              "content.intro",
              "Pre-built lesson sets you can use without an API key. Downloads are cached locally and work offline after the first fetch.",
            )}
          </p>
          {sources.length > 0 && (
            <p className="content-sources mt-1" data-testid="content-sources">
              {t("content.sources", "Sources")}:{" "}
              {sources.map((src) => `${src.source} @ ${src.branch}`).join(", ")}
            </p>
          )}
        </div>
      )}
    </>
  );
}
