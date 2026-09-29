/**
 * DiscoverResults - the visible batch of Discover results, as the compact
 * list or the card grid (#1262, following the global content-view
 * preference). Split out of ``Discover.tsx`` (#3271); every value and action
 * comes in by prop, only the labels are resolved here.
 *
 * @example
 * <DiscoverResults
 *   viewMode={viewMode}
 *   sets={query.visibleResults}
 *   downloadedKeys={downloadedKeys}
 *   newKeys={newKeys}
 *   downloadState={actions.downloadState}
 *   downloadProgress={actions.downloadProgress}
 *   onDownload={actions.handleDownload}
 *   onRemove={actions.handleRemove}
 * />
 */

import { useI18n } from "../../../hooks/ui/useI18n";
import type { ContentViewMode } from "../../../lib/content/browse/prefs/viewModePref";
import { isOfficialSource } from "../../../lib/content/repos/content-repos";
import { discoverSetKey } from "../../../lib/content/repos/discover-index";
import type { SearchableSet } from "../../../lib/content/repos/search-index-loader";
import DiscoverSetListView from "../../../shared/media/DiscoverSetListView";
import SetDiscoveryCard, {
  type SetDiscoveryCardLabels,
  type SetDiscoveryDownloadState,
} from "../../../shared/media/SetDiscoveryCard";

/** Format the "DE → ES" language badge from a set's pair. */
function languageBadge(set: SearchableSet): string {
  const source = set.source_language ? set.source_language.toUpperCase() : "";
  const target = set.target_language ? set.target_language.toUpperCase() : "";
  if (source && target) return `${source} → ${target}`;
  return target || source;
}

interface DiscoverResultsProps {
  viewMode: ContentViewMode;
  /** The batch of results to render (not the full result list). */
  sets: SearchableSet[];
  downloadedKeys: Set<string>;
  newKeys: Set<string>;
  downloadState: Record<string, SetDiscoveryDownloadState>;
  downloadProgress: Record<string, { current: number; total: number }>;
  onDownload: (set: SearchableSet) => void;
  onRemove: (set: SearchableSet) => void;
}

/** The result batch as list rows or grid cards, per the view mode. */
export default function DiscoverResults({
  viewMode,
  sets,
  downloadedKeys,
  newKeys,
  downloadState,
  downloadProgress,
  onDownload,
  onRemove,
}: DiscoverResultsProps) {
  const { t } = useI18n();

  const cardLabels: SetDiscoveryCardLabels = {
    download: t("discover.card.download", "Download"),
    downloading: t("discover.card.downloading", "Downloading…"),
    retry: t("discover.card.retry", "Retry"),
    downloaded: t("discover.card.downloaded", "Already present"),
    lessons: "",
    cards: "",
    aiChecked: t("discover.card.ai_checked", "AI-checked"),
    trust: "",
    remove: t("discover.card.remove", "Remove"),
    progress: t("discover.card.progress", "Downloading lessons"),
    reviewGenerated: t("discover.review.generated_badge", "Machine-made"),
    reviewReviewed: t("discover.review.reviewed_badge", "Reviewed"),
  };

  const newBadgeLabel = t("discover.badge.new", "New");

  function trustLabel(level: number): string {
    if (level >= 3) return t("discover.trust.official", "Officially recommended");
    if (level >= 2) return t("discover.trust.verified", "Verified");
    if (level >= 1) return t("discover.trust.validated", "Validated");
    return "";
  }

  if (viewMode === "list") {
    return (
      <DiscoverSetListView
        sets={sets}
        keyFor={discoverSetKey}
        isDownloaded={(set) => downloadedKeys.has(discoverSetKey(set))}
        stateFor={(set) => downloadState[discoverSetKey(set)] ?? "idle"}
        canRemove={(set) => !isOfficialSource(set.repo_url)}
        isNew={(set) => newKeys.has(discoverSetKey(set))}
        onDownload={onDownload}
        onRemove={onRemove}
        labels={{
          download: cardLabels.download,
          downloading: cardLabels.downloading,
          retry: cardLabels.retry,
          downloaded: cardLabels.downloaded,
          remove: cardLabels.remove,
          lessons: (count) =>
            t("discover.card.lessons", "{n} lessons").replace("{n}", String(count)),
          newBadge: newBadgeLabel,
          reviewGenerated: cardLabels.reviewGenerated,
          reviewReviewed: cardLabels.reviewReviewed,
        }}
      />
    );
  }

  return (
    <ul
      className="grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="discover-results"
    >
      {sets.map((set) => {
        const key = discoverSetKey(set);
        return (
          <li key={key}>
            <SetDiscoveryCard
              set={set}
              isDownloaded={downloadedKeys.has(key)}
              state={downloadState[key] ?? "idle"}
              progress={downloadProgress[key]}
              isNew={newKeys.has(key)}
              newLabel={newBadgeLabel}
              onDownload={onDownload}
              onRemove={isOfficialSource(set.repo_url) ? undefined : onRemove}
              languageLabel={languageBadge(set)}
              labels={{
                ...cardLabels,
                lessons: t("discover.card.lessons", "{n} lessons").replace(
                  "{n}",
                  String(set.lesson_count),
                ),
                cards: t("discover.card.cards", "{n} cards").replace(
                  "{n}",
                  String(set.card_count),
                ),
                trust: trustLabel(set.trust_level),
              }}
              testId={`discover-card-${set.id}`}
            />
          </li>
        );
      })}
    </ul>
  );
}
