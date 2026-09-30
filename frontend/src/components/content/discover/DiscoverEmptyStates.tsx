/**
 * The two empty states of the Discover page, split out of ``Discover.tsx``
 * (#3271). Neither is a dead end (EXP-048 #2324): an empty library points at
 * adding a source or writing a lesson, and an empty filter result offers the
 * "All languages" escape (#1343), one computed exit per active facet and a
 * reset of every added filter.
 *
 * @example
 * {allSets.length === 0 ? <DiscoverNoSets /> : <DiscoverNoResults {...props} />}
 */

import { Link } from "react-router";

import { useI18n } from "../../../hooks/ui/useI18n";
import type { RelaxationHint } from "../../../lib/content/repos/discover-index";

/** Empty library: no repo offers a single set. */
export function DiscoverNoSets() {
  const { t } = useI18n();
  return (
    <div className="text-muted-foreground" data-testid="discover-empty-none">
      <p>{t("discover.empty.no_sets", "No content available yet.")}</p>
      {/* The library genuinely has nothing: this is its own statement, not
          a filter problem — point at adding a source or writing a lesson
          (EXP-048 #2324). */}
      <p className="mt-2" data-testid="discover-empty-add-source">
        <Link to="/add-repo" className="text-accent hover:underline">
          {t("discover.empty.add_source", "Add your own source")}
        </Link>{" "}
        {t("discover.empty.or", "or")}{" "}
        <Link to="/create-lesson" className="text-accent hover:underline">
          {t("discover.empty.create_lesson", "create a lesson")}
        </Link>
        .
      </p>
    </div>
  );
}

interface DiscoverNoResultsProps {
  /** The active (debounced) search query, quoted in the message. */
  query: string;
  /** Whether a source-language filter is active (offers "All languages"). */
  sourceLanguageActive: boolean;
  onShowAllLanguages: () => void;
  relaxHints: RelaxationHint[];
  onClearFacet: (facet: string) => void;
  /** Whether any filter beyond the source language is set. */
  hasAddedFilter: boolean;
  onResetAll: () => void;
}

/** The filters leave nothing: offer computed ways out. */
export function DiscoverNoResults({
  query,
  sourceLanguageActive,
  onShowAllLanguages,
  relaxHints,
  onClearFacet,
  hasAddedFilter,
  onResetAll,
}: DiscoverNoResultsProps) {
  const { t } = useI18n();

  const facetLabel = (facet: string): string => {
    switch (facet) {
      case "query":
        return t("discover.bar.search", "Search");
      case "targetLanguage":
        return t("discover.filter.target_language", "Target language");
      case "level":
        return t("discover.filter.level", "Level");
      case "domain":
        return t("discover.filter.domain", "Domain");
      case "trust":
        return t("discover.filter.trust", "Trust");
      case "reviewStatus":
        return t("discover.filter.review", "Review");
      case "source":
        return t("discover.filter.source", "Source");
      default:
        return facet;
    }
  };

  return (
    <div className="text-muted-foreground" data-testid="discover-empty-results">
      <p>
        {t("discover.empty.no_results", "No results for “{query}”.").replace(
          "{query}",
          query,
        )}
      </p>
      {/* Never a dead end: when a source-language filter is active, offer a
          one-tap escape to "All languages" (#1343). */}
      {sourceLanguageActive && (
        <p className="mt-2" data-testid="discover-empty-language">
          {t(
            "discover.empty.language_hint",
            "Nothing in this language yet.",
          )}{" "}
          <button
            type="button"
            className="text-accent hover:underline"
            onClick={onShowAllLanguages}
            data-testid="discover-show-all-languages"
          >
            {t("discover.filter.all_languages", "All languages")}
          </button>
        </p>
      )}
      {/* Computed, per-facet exits: "Without {facet}: {n} sets" — the
          source-language fallback generalised to every facet (#2324). */}
      {relaxHints.length > 0 && (
        <ul className="mt-2 flex list-none flex-col gap-1" data-testid="discover-empty-hints">
          {relaxHints.map((hint) => (
            <li key={hint.facet}>
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={() => onClearFacet(hint.facet)}
                data-testid={`discover-empty-hint-${hint.facet}`}
              >
                {t("discover.empty.without_facet", "Without {facet}: {n} sets")
                  .replace("{facet}", facetLabel(hint.facet))
                  .replace("{n}", String(hint.count))}
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* One action to clear every added restriction (#2324). */}
      {hasAddedFilter && (
        <p className="mt-2">
          <button
            type="button"
            className="font-medium text-accent hover:underline"
            onClick={onResetAll}
            data-testid="discover-empty-reset"
          >
            {t("discover.empty.reset_all", "Reset all filters")}
          </button>
        </p>
      )}
    </div>
  );
}
