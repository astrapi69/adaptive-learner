/**
 * DiscoverHeader - the Discover page title with its on-demand explanation,
 * plus the way back to the Content Browser once a set was downloaded this
 * session. Split out of ``Discover.tsx`` (#3271).
 *
 * @example
 * <DiscoverHeader hasDownloaded={hasDownloaded} />
 */

import { Compass } from "lucide-react";
import { Link } from "react-router";

import { useI18n } from "../../../hooks/ui/useI18n";
import InfoHint from "../../../shared/feedback/InfoHint";

interface DiscoverHeaderProps {
  /** Whether a set finished downloading in this visit (#772). */
  hasDownloaded: boolean;
}

/** Title row + the conditional "Go to Content Browser" link. */
export default function DiscoverHeader({ hasDownloaded }: DiscoverHeaderProps) {
  const { t } = useI18n();
  return (
    <>
      <header className="mb-4 flex items-center gap-2">
        <Compass className="size-6 text-accent" aria-hidden="true" />
        <h1 className="text-xl font-semibold">{t("discover.title", "Discover content")}</h1>
        {/* #1251 — the permanent subtitle is replaced by an info button that
            expands the explanation inline on demand (blinks gently for a
            first-time visitor, then bows out). */}
        <InfoHint
          storageId="content_discover"
          text={t("discover.subtitle", "Find learning material before you download it.")}
          label={t("ui.info.show", "Show information")}
          className="mb-0"
          testId="discover-info"
        />
      </header>

      {/* #772 — once the learner has downloaded a set this session, point them
          back to the Content Browser ("Meine Inhalte"), where it now lives. */}
      {hasDownloaded && (
        <p
          className="mb-3 text-sm text-muted-foreground"
          data-testid="discover-to-content"
        >
          <Link to="/content?tab=my" className="text-accent hover:underline">
            {t("discover.to_content", "Go to Content Browser")} →
          </Link>
        </p>
      )}
    </>
  );
}
