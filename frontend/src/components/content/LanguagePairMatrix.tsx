/**
 * LanguagePairMatrix - an alternative entry into the Discover list that sets
 * BOTH language axes at once (EXP-048 #2337), presented as a collapsed-by-default
 * disclosure grouped by source language (#2359).
 *
 * The problem it solves: picking a language-learning target normally means two
 * separate steps - choose the instruction (source) language, then the learned
 * (target) language. With a handful of populated pairs the learner can instead
 * jump straight to "German → Spanish (3)"; the host wires the click to preset
 * source + target + the language entry together.
 *
 * Ordered, not a flat row (#2359): a wrapping row of every populated pair reads
 * as clutter and eats half the phone height. Instead the pairs are folded behind
 * one trigger button whose label summarizes the current choice, and - when
 * expanded - grouped under a per-source heading. Collapsed it costs one line, so
 * the phone's "only the mark line is permanently visible" rule (EXP-048 Teil
 * "Telefon") holds. The host passes the pairs already sorted most-populated-first
 * (``availableLanguagePairs``), so groups and their targets keep that order.
 *
 * App-agnostic + props-driven: the host builds every visible string (trigger,
 * heading, per-source and per-target labels, the a11y select label) and passes
 * them in - no i18n import. Token-backed Tailwind only; each control keeps a
 * >=44px touch target. The disclosure is the repo's plain idiom (``useState`` +
 * ``aria-expanded``), no new dependency.
 *
 * @example
 * <LanguagePairMatrix
 *   pairs={[{ source: "de", target: "es", count: 3 }]}
 *   triggerLabel={`${t("discover.pairs.choose", "Choose a language pair")} (1)`}
 *   activeSummary={active ? `${name("de")} → ${name("es")}` : null}
 *   heading={t("discover.pairs.heading", "Language pairs")}
 *   groupLabel={(src) => name(src)}
 *   pairLabel={(p) => `${name(p.target)} (${p.count})`}
 *   selectLabel={(p) => t("discover.pairs.select", "Choose {p}").replace("{p}", `${name(p.source)} → ${name(p.target)}`)}
 *   onSelect={(p) => applyPair(p)}
 *   activePair={{ source: effectiveSource, target: filters.targetLanguage }}
 *   testId="discover-pair-matrix"
 * />
 */

import { useId, useMemo, useState } from "react";

import { ChevronDown } from "lucide-react";

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
  /** Collapsed-state trigger label when no pair is active (e.g.
   *  "Choose a language pair (14)"). Carries the control's name so the trigger is
   *  unambiguous without sight. */
  triggerLabel: string;
  /** Summary shown on the trigger when a pair is active (e.g.
   *  "German → Spanish"); ``null`` = show {@link triggerLabel} instead. */
  activeSummary?: string | null;
  /** Heading shown above the groups when expanded (e.g. "Language pairs"). */
  heading: string;
  /** Heading for one source-language group (e.g. "German"). */
  groupLabel: (sourceCode: string) => string;
  /** Per-button label within a group (e.g. "Spanish (3)") - the source is the
   *  group heading and not repeated on the button. */
  pairLabel: (pair: LanguagePairOption) => string;
  /** aria-label for a pair button - the full pair spoken (e.g.
   *  "Choose German → Spanish"), since the visible label is target-only. */
  selectLabel: (pair: LanguagePairOption) => string;
  /** Apply a pair (the host presets both language axes + the language entry). */
  onSelect: (pair: LanguagePairOption) => void;
  /** The currently-selected pair, marked ``aria-pressed``. Omit for none. */
  activePair?: { source: string; target: string } | null;
  /** Start expanded (tests / rare host need). Default collapsed. */
  defaultOpen?: boolean;
  testId?: string;
}

/** One source-language group: the source code + its pairs, input order kept. */
interface PairGroup {
  source: string;
  pairs: LanguagePairOption[];
}

/** Group pairs by source language, preserving first-seen order (which follows
 *  the host's most-populated-first sort), and the input order within a group. */
function groupBySource(pairs: LanguagePairOption[]): PairGroup[] {
  const groups: PairGroup[] = [];
  const bySource = new Map<string, PairGroup>();
  for (const pair of pairs) {
    let group = bySource.get(pair.source);
    if (!group) {
      group = { source: pair.source, pairs: [] };
      bySource.set(pair.source, group);
      groups.push(group);
    }
    group.pairs.push(pair);
  }
  return groups;
}

export default function LanguagePairMatrix({
  pairs,
  triggerLabel,
  activeSummary = null,
  heading,
  groupLabel,
  pairLabel,
  selectLabel,
  onSelect,
  activePair = null,
  defaultOpen = false,
  testId = "language-pair-matrix",
}: LanguagePairMatrixProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const groups = useMemo(() => groupBySource(pairs), [pairs]);
  if (pairs.length === 0) return null;
  return (
    <section className="mb-4" data-testid={testId}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={activeSummary ? `${heading}: ${activeSummary}` : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-app border border-border bg-card px-3 text-sm text-fg-primary hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        data-testid={`${testId}-trigger`}
      >
        <ChevronDown
          className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
        <span className="truncate">{activeSummary ?? triggerLabel}</span>
      </button>
      {open ? (
        <div id={panelId} className="mt-2 space-y-3" data-testid={`${testId}-panel`}>
          <h2 className="sr-only">{heading}</h2>
          {groups.map((group) => (
            <div key={group.source}>
              <h3
                className="mb-1 text-xs font-medium uppercase tracking-wide text-fg-muted"
                data-testid={`${testId}-group-${group.source}`}
              >
                {groupLabel(group.source)}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {group.pairs.map((pair) => {
                  const active =
                    activePair != null &&
                    activePair.source === pair.source &&
                    activePair.target === pair.target;
                  return (
                    <button
                      key={`${pair.source}->${pair.target}`}
                      type="button"
                      aria-pressed={active}
                      aria-label={selectLabel(pair)}
                      onClick={() => onSelect(pair)}
                      className={`inline-flex min-h-11 shrink-0 items-center rounded-app border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        active
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border bg-card text-fg-primary hover:bg-[var(--bg-elevated)]"
                      }`}
                      data-testid={`${testId}-${pair.source}-${pair.target}`}
                    >
                      {pairLabel(pair)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
