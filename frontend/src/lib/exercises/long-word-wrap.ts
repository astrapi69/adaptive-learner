/**
 * Tailwind utilities that let ONE over-long word wrap inside a fixed-width
 * tile, option row or label (#3174). Content such as "kleinste
 * bedeutungsunterscheidende Lauteinheit" used to run past a 375px matching
 * tile because a word without a break opportunity stays on one line.
 *
 * - ``hyphens-auto`` asks the browser to hyphenate at dictionary points.
 *   That needs the language of the TEXT, so a caller sets ``lang`` on the
 *   tile container with the content language (the lesson's target or
 *   source language); ``<html lang>`` follows the UI language and is the
 *   wrong dictionary for a German set played in an English UI.
 * - ``[overflow-wrap:anywhere]`` is the fallback when no hyphenation point
 *   exists (a proper noun, an unknown language). Unlike ``break-words``
 *   (``overflow-wrap: break-word``) it also lets the word contribute its
 *   break opportunities to min-content sizing, so a grid or flex track
 *   never grows past its column to fit the unbroken word.
 *
 * Soft hyphens (``&shy;``) in the content are not an option: a tile label
 * is also the comparison value of the exercise, and a hidden character
 * breaks the equality.
 *
 * @example
 * ```tsx
 * <ul lang={targetLanguage ?? undefined}>
 *   <li><span className={cn("min-w-0 flex-1", LONG_WORD_WRAP)}>{label}</span></li>
 * </ul>
 * ```
 */
export const LONG_WORD_WRAP = "hyphens-auto [overflow-wrap:anywhere]";
