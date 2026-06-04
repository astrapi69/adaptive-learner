/**
 * relativeTime — a tiny locale-aware "how long ago" formatter built
 * on the platform's ``Intl.RelativeTimeFormat`` (no external
 * dependency, supports all 8 app languages out of the box).
 *
 * Used by the redesigned Learning Path (Level 1 set rows + Level 2
 * lesson rows) to render last-activity hints like "gestern" /
 * "yesterday", "vor 3 Tagen" / "3 days ago", "vor 2 Wochen" /
 * "2 weeks ago".
 *
 * Picks the largest sensible unit (year → month → week → day → hour →
 * minute → second) and formats it with ``numeric: "auto"`` so ±1
 * collapses to the natural form ("gestern" rather than "vor 1 Tag").
 * ``now`` is injectable so tests stay deterministic.
 */

/** Unit ladder, largest first, with the second-count threshold at
 *  which that unit becomes the natural choice. Months ≈ 30 days,
 *  years ≈ 365 days — good enough for a relative hint. */
const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 24 * 60 * 60],
    ["month", 30 * 24 * 60 * 60],
    ["week", 7 * 24 * 60 * 60],
    ["day", 24 * 60 * 60],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
];

/** Cache one formatter per language — constructing them is not free. */
const formatters = new Map<string, Intl.RelativeTimeFormat>();

function formatterFor(lang: string): Intl.RelativeTimeFormat {
    let fmt = formatters.get(lang);
    if (!fmt) {
        try {
            fmt = new Intl.RelativeTimeFormat(lang, {numeric: "auto"});
        } catch {
            // Unknown / unsupported BCP-47 tag — fall back to English.
            fmt = new Intl.RelativeTimeFormat("en", {numeric: "auto"});
        }
        formatters.set(lang, fmt);
    }
    return fmt;
}

/**
 * Format ``date`` relative to ``now`` in the given language.
 *
 * @param date  the past (or future) instant to describe.
 * @param lang  BCP-47 language tag (de, en, es, fr, el, pt, tr, ja).
 * @param now   reference instant; defaults to the current time.
 */
export function relativeTime(
    date: Date,
    lang: string,
    now: Date = new Date(),
): string {
    const fmt = formatterFor(lang);
    const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
    const absSeconds = Math.abs(diffSeconds);

    // Under 10 seconds reads as "now" / "jetzt" regardless of sign.
    if (absSeconds < 10) {
        return fmt.format(0, "second");
    }

    for (const [unit, unitSeconds] of UNITS) {
        if (absSeconds >= unitSeconds) {
            const value = Math.round(diffSeconds / unitSeconds);
            return fmt.format(value, unit);
        }
    }
    // Unreachable (the "second" rung has threshold 1) — defensive.
    return fmt.format(diffSeconds, "second");
}
