/**
 * #1927 — size limits for the Create-Lesson book file upload.
 *
 * The file cap is generous (whole books with embedded images; only text
 * is ever extracted, images inside the container are never unpacked).
 * The per-section caps protect the AI prompt and the localStorage draft
 * autosave — the wizard is deliberately "one section per run".
 */

/** Maximum accepted upload size (20 MiB). */
export const MAX_BOOK_FILE_SIZE = 20 * 1024 * 1024;

/** Hard cap on the characters of a section applied to the text field. */
export const MAX_SECTION_CHARS = 50_000;

/** Soft threshold above which the UI hints that shorter sections
 *  produce better AI results. */
export const SOFT_SECTION_CHARS = 15_000;
