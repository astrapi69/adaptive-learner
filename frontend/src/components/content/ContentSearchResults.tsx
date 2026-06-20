/**
 * ContentSearchResults — the "Your content" search view that replaces the
 * browse tree while a search is active: a result count, per-set grouped
 * lesson matches with query highlighting, and a "find more on /discover"
 * hint. Extracted verbatim from ``Content.tsx`` (#883).
 *
 * Presentational + props-driven: the parent supplies the computed
 * ``searchResult`` (from ``useContentSearch``), the downloaded sets used to
 * resolve a match back to its set row, and the lesson-open callback.
 */

import { Link } from "react-router-dom";

import type { ContentSearchResult } from "../../lib/content/content-search";
import { splitHighlight } from "../../lib/content/content-search";
import { useI18n } from "../../hooks/ui/useI18n";
import type { ContentSetEntry } from "../../storage/types";

export interface ContentSearchResultsProps {
  searchResult: ContentSearchResult;
  downloadedSets: ContentSetEntry[];
  onOpenLesson: (source: string, id: string, filename: string) => void;
}

/** Highlight raw query occurrences inside a label. */
function highlightNodes(text: string, query: string) {
  return splitHighlight(text, query).map((seg, i) =>
    seg.match ? (
      <mark key={i} className="bg-transparent font-semibold text-accent">
        {seg.text}
      </mark>
    ) : (
      <span key={i}>{seg.text}</span>
    ),
  );
}

/** The search-results section for the Content Browser. */
export default function ContentSearchResults({
  searchResult,
  downloadedSets,
  onOpenLesson,
}: ContentSearchResultsProps) {
  const { t } = useI18n();
  return (
    <section className="content-search-results space-y-4" data-testid="content-search-results">
      <h2 className="font-semibold" data-testid="content-search-your">
        {t("content.search.your_content", "Your content")}
      </h2>
      {searchResult.matches.length === 0 ? (
        <div className="content-empty" data-testid="content-search-empty">
          <p>
            {t("content.search.no_results", "No results for '{query}'").replace(
              "{query}",
              searchResult.query.trim(),
            )}
          </p>
          <p className="muted">{t("content.search.hint", "Try a different search term")}</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" data-testid="content-search-count">
            {t("content.search.results", "{count} results").replace(
              "{count}",
              String(searchResult.lessonCount),
            )}
          </p>
          {searchResult.matches.map((match) => {
            const entry = downloadedSets.find(
              (s) => s.source === match.source && s.id === match.setId,
            );
            if (!entry) return null;
            return (
              <div
                key={`${match.source}#${match.setId}`}
                data-testid={`content-search-set-${match.setId}`}
              >
                <h3 className="font-semibold">
                  {highlightNodes(entry.title, searchResult.query)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    · {(entry.source_language || "").toUpperCase()}
                    {entry.target_language
                      ? ` → ${entry.target_language.toUpperCase()}`
                      : ""}{" "}
                    {entry.level}
                  </span>
                </h3>
                <ul className="mt-1 space-y-1 pl-4">
                  {match.matchedLessons.map((lessonRef) => (
                    <li key={lessonRef.filename}>
                      <button
                        type="button"
                        className="text-left text-accent hover:underline"
                        onClick={() => onOpenLesson(match.source, match.setId, lessonRef.filename)}
                        data-testid={`content-search-lesson-${match.setId}-${lessonRef.filename}`}
                      >
                        {highlightNodes(lessonRef.title, searchResult.query)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </>
      )}
      {/* #772 — the Content Browser shows only local content. Not-yet-
          downloaded sets are discovered on /discover; point there instead
          of surfacing index results here. */}
      <p className="text-sm text-muted-foreground" data-testid="content-search-discover-hint">
        <Link to="/content?tab=discover" className="text-accent hover:underline">
          {t("content.discover_more", "Find more content")} →
        </Link>
      </p>
    </section>
  );
}
