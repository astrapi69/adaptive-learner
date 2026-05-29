/**
 * Mission scheduling helpers (EXP-010 / Phase 56D / P-159, P-160).
 *
 * Missions roll over at local midnight: assignment is keyed by the
 * local date, so on a new day the "today" query is empty and a
 * fresh set is assigned. Uncompleted missions simply stop being
 * queried - they expire with NO penalty (no guilt mechanics).
 *
 * The local date is derived from the user's language (a coarse
 * timezone heuristic) until an explicit timezone setting exists;
 * UTC is the fallback.
 *
 * The streak joker (P-160) lets a single missed day NOT break the
 * mission streak when a streak freeze is available.
 */

/** Coarse language -> IANA timezone heuristic. */
const LANGUAGE_TIMEZONE: Record<string, string> = {
    de: "Europe/Berlin",
    en: "UTC",
    es: "Europe/Madrid",
    fr: "Europe/Paris",
    el: "Europe/Athens",
    pt: "Europe/Lisbon",
    tr: "Europe/Istanbul",
    ja: "Asia/Tokyo",
};

export function languageToTimezone(lang: string): string {
    const base = lang.split("-")[0]?.toLowerCase() ?? "";
    return LANGUAGE_TIMEZONE[base] ?? "UTC";
}

/**
 * The local date (YYYY-MM-DD) in the user's timezone. Falls back
 * to the UTC date when ``Intl`` / the timezone is unavailable.
 */
export function localTodayIso(lang: string, now: Date = new Date()): string {
    const timeZone = languageToTimezone(lang);
    try {
        // en-CA formats as YYYY-MM-DD.
        return new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(now);
    } catch {
        return now.toISOString().slice(0, 10);
    }
}

function previousDayIso(iso: string): string {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}

/**
 * Count the consecutive-day mission streak ending at ``today``.
 *
 * ``completionDates`` is the set of YYYY-MM-DD days on which the
 * learner completed at least one mission. The streak walks
 * backwards from today; when a day is missing and a freeze is
 * available, ONE gap is bridged (the joker) and the walk
 * continues. A second gap ends the streak.
 *
 * Returns ``{streak, jokerUsed}``.
 */
export function missionStreakWithJoker(
    completionDates: ReadonlySet<string>,
    today: string,
    options: {freezeAvailable: boolean} = {freezeAvailable: false},
): {streak: number; jokerUsed: boolean} {
    let streak = 0;
    let jokerUsed = false;
    let cursor = today;
    // Allow today itself to be incomplete without ending the
    // streak prematurely: if today is missing, start from
    // yesterday (today is simply not done YET).
    if (!completionDates.has(cursor)) {
        cursor = previousDayIso(cursor);
    }
    while (true) {
        if (completionDates.has(cursor)) {
            streak += 1;
            cursor = previousDayIso(cursor);
            continue;
        }
        // Missing day: spend the joker once if available.
        if (options.freezeAvailable && !jokerUsed) {
            jokerUsed = true;
            cursor = previousDayIso(cursor);
            continue;
        }
        break;
    }
    return {streak, jokerUsed};
}
