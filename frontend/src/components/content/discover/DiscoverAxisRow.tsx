/**
 * DiscoverAxisRow - the always-visible axis controls of the Discover page:
 * entry point (#2331), source language (#1343 / #1699) and, when the source
 * offers more than one, target language (#2322). Split out of
 * ``Discover.tsx`` (#3271); presentational, every value comes in by prop.
 *
 * @example
 * <DiscoverAxisRow
 *   entryOptions={facets.entryOptions}
 *   entry={query.effectiveEntry}
 *   onEntryChange={query.handleEntryChange}
 *   languageOptions={facets.languageOptions}
 *   sourceLanguage={query.effectiveSourceLanguage}
 *   onSourceLanguageChange={query.setLangChoice}
 *   showTargetFacet={facets.showTargetFacet}
 *   targetLanguageOptions={facets.targetLanguageOptions}
 *   targetLanguage={query.filters.targetLanguage}
 *   onTargetLanguageChange={query.setTargetLanguage}
 * />
 */

import { useI18n } from "../../../hooks/ui/useI18n";
import FilterMenuButton, { type FilterMenuOption } from "../../../shared/forms/FilterMenuButton";

interface DiscoverAxisRowProps {
  entryOptions: FilterMenuOption[];
  entry: string;
  onEntryChange: (value: string) => void;
  languageOptions: FilterMenuOption[];
  sourceLanguage: string;
  onSourceLanguageChange: (value: string) => void;
  showTargetFacet: boolean;
  targetLanguageOptions: FilterMenuOption[];
  targetLanguage: string;
  onTargetLanguageChange: (value: string) => void;
}

/** The entry, source-language and target-language menu buttons in one row. */
export default function DiscoverAxisRow({
  entryOptions,
  entry,
  onEntryChange,
  languageOptions,
  sourceLanguage,
  onSourceLanguageChange,
  showTargetFacet,
  targetLanguageOptions,
  targetLanguage,
  onTargetLanguageChange,
}: DiscoverAxisRowProps) {
  const { t } = useI18n();
  // #1699 — the source-language filter is ALWAYS visible (never hidden
  // behind the collapsible panel), so the learner always sees that the
  // list is filtered and can change it in one tap. Default = UI locale;
  // an explicit choice persists and wins over the default (#1343).
  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-2"
      data-testid="discover-language-filter-row"
    >
      {/* #2331 — the entry point (Sprache lernen / Fachgebiet / Alles) is the
          primary axis and the first always-visible control: it presets WHICH
          second axis (target+level vs. domain) the learner refines by. */}
      <FilterMenuButton
        label={t("discover.entry.label", "I want to")}
        options={entryOptions}
        value={entry}
        onChange={onEntryChange}
        testId="discover-entry-filter"
      />
      <FilterMenuButton
        label={t("discover.filter.language", "Language")}
        options={languageOptions}
        value={sourceLanguage}
        onChange={onSourceLanguageChange}
        testId="discover-language-filter"
      />
      {/* #2322 — the target (learned) language is the second axis of a
          language search, and just as always-visible as the source. Shown
          once the current source offers more than one target. */}
      {showTargetFacet && (
        <FilterMenuButton
          label={t("discover.filter.target_language", "Target language")}
          options={targetLanguageOptions}
          value={targetLanguage}
          onChange={onTargetLanguageChange}
          testId="discover-target-filter"
        />
      )}
    </div>
  );
}
