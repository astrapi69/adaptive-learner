/**
 * Shared layout of the About cards' label/value lists (#3340).
 *
 * On phones a two-column grid let the bold label set the column width, so
 * the value column shrank to about 60 px and ``break-all`` split every word
 * ("Impre/ssum", "Browse/r-Speicher"). Below ``sm`` label and value now stack
 * in one column; from ``sm`` up the two-column grid returns. Values wrap at
 * word boundaries and break a long token (a path, a URL) only where it does
 * not fit.
 *
 * @example
 * <dl className={ABOUT_LIST_CLASS}>
 *   <dt className={ABOUT_LABEL_CLASS}><strong>Path</strong></dt>
 *   <dd className={ABOUT_VALUE_CLASS}>/home/u/.config/app</dd>
 * </dl>
 */
export const ABOUT_LIST_CLASS =
    "grid grid-cols-1 sm:grid-cols-[minmax(0,max-content)_minmax(0,1fr)] gap-x-4 gap-y-1 text-[0.9rem] m-0";

/** Row label: the gap between stacked pairs on phones, none in the grid. */
export const ABOUT_LABEL_CLASS = "mt-2 first:mt-0 sm:mt-0";

/** Row value: wraps between words, breaks a long token only where needed. */
export const ABOUT_VALUE_CLASS = "m-0 min-w-0 break-words";
