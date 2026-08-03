/**
 * LanguagePairMatrix — an alternative entry into the Discover list that sets
 * BOTH language axes at once (EXP-048 #2337).
 *
 * The problem it solves: picking a language-learning target normally means two
 * separate steps — choose the instruction (source) language, then the learned
 * (target) language. With a handful of populated pairs the learner can instead
 * jump straight to "German → Spanish (3)" from an overview; the host wires the
 * click to preset source + target + the language entry together.
 *
 * A compact, wrapping row of buttons rather than a true N×N grid: at this
 * catalogue size only a dozen pairs are populated, so the empty cells of a full
 * matrix would be noise. The most-populated pair comes first (the host sorts via
 * ``availableLanguagePairs``). The currently-selected pair is marked
 * ``aria-pressed`` so the overview doubles as a "you are here".
 *
 * App-agnostic + props-driven: the host builds each pair's visible label
 * (resolved language names + count) and passes every string in — no i18n import.
 * Token-backed Tailwind only; each button keeps a >=44px touch target.
 *
 * @example
 * <LanguagePairMatrix
 *   pairs={[{ source: "de", target: "es", count: 3 }]}
 *   heading={t("discover.pairs.heading", "Language pairs")}
 *   formatLabel={(p) => `${name(p.source)} → ${name(p.target)} (${p.count})`}
 *   selectLabel={(l) => t("discover.pairs.select", "Choose {p}").replace("{p}", l)}
 *   onSelect={(p) => applyPair(p)}
 *   activePair={{ source: effectiveSource, target: filters.targetLanguage }}
 *   testId="discover-pair-matrix"
 * />
 */

/** One populated source→target language pair offered by the matrix. */
export interface LanguagePairOption {
  /** BCP-47 instruction (source) language code. */
  source: string;
  /** BCP-47 learned (target) language code. */
  target: string;
  count: number;
}

export interface LanguagePairMatrixProps {
  pairs: LanguagePairOption[];
  /** Heading shown above the buttons (e.g. "Language pairs"). */
  heading: string;
  /** Builds a pair's visible label, e.g. "German → Spanish (3)". */
  formatLabel: (pair: LanguagePairOption) => string;
  /** Builds a button's aria-label from its already-formatted visible label. */
  selectLabel: (formattedLabel: string) => string;
  /** Apply a pair (the host presets both language axes + the language entry). */
  onSelect: (pair: LanguagePairOption) => void;
  /** The currently-selected pair, marked ``aria-pressed``. Omit for none. */
  activePair?: { source: string; target: string } | null;
  testId?: string;
}

export default function LanguagePairMatrix({
  pairs,
  heading,
  formatLabel,
  selectLabel,
  onSelect,
  activePair = null,
  testId = "language-pair-matrix",
}: LanguagePairMatrixProps) {
  if (pairs.length === 0) return null;
  return (
    <section className="mb-4" data-testid={testId}>
      <h2 className="mb-2 text-sm font-medium text-fg-muted">{heading}</h2>
      <div className="flex flex-wrap items-center gap-2">
        {pairs.map((pair) => {
          const label = formatLabel(pair);
          const active =
            activePair != null &&
            activePair.source === pair.source &&
            activePair.target === pair.target;
          return (
            <button
              key={`${pair.source}->${pair.target}`}
              type="button"
              aria-pressed={active}
              aria-label={selectLabel(label)}
              onClick={() => onSelect(pair)}
              className={`inline-flex min-h-11 shrink-0 items-center rounded-app border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                active
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-card text-fg-primary hover:bg-[var(--bg-elevated)]"
              }`}
              data-testid={`${testId}-${pair.source}-${pair.target}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
