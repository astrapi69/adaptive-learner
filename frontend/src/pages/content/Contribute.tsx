/**
 * /contribute — "Beitragen" page (#1149).
 *
 * The community-contribution surface: it lists the gaps in the community
 * library ("Missing Lessons") and invites the learner to help fill them.
 * Previously this block lived under "Meine Inhalte" (the {@link Content}
 * tab), which conflated consumption (downloaded content) with production
 * (contribution prompts). It now has its own area + nav entry.
 *
 * Deliberately distinct from the {@link Discover} page (EXP-034): Discover
 * is about FINDING and DOWNLOADING content (consumption); Contribute is
 * about SEEING gaps and giving back (production).
 *
 * Storage-mode-agnostic: routes the set list through
 * ``getStorage().contentLoader.listSets()`` so it works in API mode and
 * Dexie mode alike. Reuses the existing {@link detectGaps} detector
 * unchanged via {@link ContentGapsSection} — only the render position
 * moved here.
 */

import { HeartHandshake } from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError } from "../../api/client";
import ContentGapsSection from "../../components/content/contributions/ContentGapsSection";
import { useI18n } from "../../hooks/ui/useI18n";
import { detectGaps } from "../../lib/content/validation/gap-detector";
import { getStorage } from "../../storage";
import { USER_GENERATED_SOURCE } from "../../storage/types";
import type { ContentSetEntry } from "../../storage/types";
import { notify } from "../../utils/notify";

/** Community contribution target repo (manual maintainer review). */
const COMMUNITY_REPO = "astrapi69/adaptive-learner-content";

export default function Contribute() {
  const { t, lang } = useI18n();
  const [downloadedSets, setDownloadedSets] = useState<ContentSetEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await getStorage().contentLoader.listSets();
        if (cancelled) return;
        // Gaps are derived from the community library the learner has
        // downloaded; user-generated sets are not part of that library.
        setDownloadedSets(
          data.sets.filter((s) => s.source !== USER_GENERATED_SOURCE),
        );
      } catch (err) {
        if (!cancelled) {
          notify.error(
            t("content.error.list_failed", "Could not load content sets."),
            { apiError: err instanceof ApiError ? err : undefined },
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  // Reuse the existing detector (no new gap logic) to decide whether to
  // render the section or the "no gaps" empty state.
  const hasGaps = detectGaps(downloadedSets).length > 0;

  if (loading) {
    return (
      <main id="main" className="page" data-testid="contribute-loading">
        <p className="text-fg-muted">
          {t("contribute.loading", "Loading…")}
        </p>
      </main>
    );
  }

  return (
    <main id="main" className="page" data-testid="contribute-page">
      <header className="mb-4 flex items-center gap-2">
        <HeartHandshake className="size-6 text-accent" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-semibold">
            {t("contribute.title", "Contribute")}
          </h1>
          <p className="text-sm text-fg-muted">
            {t(
              "contribute.intro",
              "Help grow the community library by filling its gaps.",
            )}
          </p>
        </div>
      </header>

      {hasGaps ? (
        <ContentGapsSection
          downloadedSets={downloadedSets}
          lang={lang}
          communityRepo={COMMUNITY_REPO}
        />
      ) : (
        <p className="text-fg-muted" data-testid="contribute-empty">
          {t(
            "contribute.empty",
            "No gaps right now — the community library covers your downloaded sets. Thank you!",
          )}
        </p>
      )}
    </main>
  );
}
