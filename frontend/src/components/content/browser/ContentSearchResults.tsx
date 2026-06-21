/**
 * Search-results section for the /content page (extracted from
 * Content.tsx, #896).
 *
 * Renders "Your content" — the matched downloaded sets and their matched
 * lessons with raw-query highlighting, an empty state, a result count,
 * and the persistent "Find more content" hint (discovery moved to
 * /discover, #772). Presentational: the page owns the search view-model
 * (``useContentSearch``) and the lesson-open handler. Behaviour-
 * preserving: identical testids, text, and handlers.
 */

import { Link } from "react-router-dom";

import {
  splitHighlight,
  type ContentSearchResult,
} from "../../../lib/content/browse/content-search";
import { useI18n } from "../../../hooks/ui/useI18n";
import type { ContentSetEntry } from "../../../storage/types";

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

interface ContentSearchResultsProps {
  searchResult: ContentSearchResult;
  downloadedSets: ContentSetEntry[];
  openLessonFile: (source: string, id: string, filename: string) => void;
}

/** The /content "Your content" search-results section. */
export default function ContentSearchResults({
  searchResult,
  downloadedSets,
  openLessonFile,
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
                        onClick={() =>
                          openLessonFile(match.source, match.setId, lessonRef.filename)
                        }
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
