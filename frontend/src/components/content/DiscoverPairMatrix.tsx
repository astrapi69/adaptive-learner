/**
 * DiscoverPairMatrix — the connected language-pair matrix for the Discover page
 * (EXP-048 #2337).
 *
 * Owns the pair concern end to end: it derives the populated source→target pairs
 * from the loaded catalogue, decides whether to show them (hidden in the
 * "knowledge" entry, and only when more than one pair exists), and formats each
 * button's label in the active UI language — then renders the presentational
 * {@link LanguagePairMatrix}. Split out of ``Discover.tsx`` so the page stays
 * under the cohesion/complexity gates and this concern is testable on its own.
 *
 * @example
 * <DiscoverPairMatrix
 *   sets={allSets}
 *   entry={effectiveEntry}
 *   activeSource={effectiveSourceLanguage}
 *   activeTarget={filters.targetLanguage}
 *   onSelect={handlePairSelect}
 * />
 */

import { useMemo } from "react";

import { useI18n } from "../../hooks/ui/useI18n";
import { languageDisplayName } from "../../lib/content/language/language-names";
import {
  availableLanguagePairs,
  type DiscoverLanguagePair,
} from "../../lib/content/repos/discover-index";
import type { SearchableSet } from "../../lib/content/repos/search-index-loader";
import LanguagePairMatrix from "./LanguagePairMatrix";

export interface DiscoverPairMatrixProps {
  /** The loaded catalogue; the pairs are derived from it. */
  sets: SearchableSet[];
  /** Active entry preset. The matrix is empty in the "knowledge" entry. */
  entry: string;
  /** Effective source language, to mark the active pair. */
  activeSource: string;
  /** Effective target language, to mark the active pair. */
  activeTarget: string;
  /** Apply a pair (the host presets both language axes + the language entry). */
  onSelect: (pair: DiscoverLanguagePair) => void;
}

export default function DiscoverPairMatrix({
  sets,
  entry,
  activeSource,
  activeTarget,
  onSelect,
}: DiscoverPairMatrixProps) {
  const { t, lang } = useI18n();
  const pairs = useMemo(() => availableLanguagePairs(sets), [sets]);
  // None in the knowledge entry, and only when more than one pair is populated
  // (a single pair is no choice). LanguagePairMatrix renders nothing for [].
  const matrixPairs = useMemo(
    () => (entry !== "knowledge" && pairs.length > 1 ? pairs : []),
    [entry, pairs],
  );
  return (
    <LanguagePairMatrix
      pairs={matrixPairs}
      heading={t("discover.pairs.heading", "Language pairs")}
      formatLabel={(pair) =>
        `${languageDisplayName(pair.source, lang)} → ${languageDisplayName(
          pair.target,
          lang,
        )} (${pair.count})`
      }
      selectLabel={(label) =>
        t("discover.pairs.select", "Choose {p}").replace("{p}", label)
      }
      onSelect={onSelect}
      activePair={{ source: activeSource, target: activeTarget }}
      testId="discover-pair-matrix"
    />
  );
}
