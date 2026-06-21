/**
 * Heading title for an imported conversation (#234).
 *
 * The Import-Detail page stored ``title`` is, for file-uploaded
 * conversations, the raw filename (e.g. ``my-chat-export``,
 * hyphenated). Once analysed, a clean human title is available at
 * ``analysis_result.topic``. The heading prefers that; otherwise it
 * falls back to the stored title, prettified when it reads like a
 * filename (known import extension stripped, slug de-hyphenated).
 */

const IMPORT_EXTENSION = /\.(json|md|markdown|txt|html?|csv)$/i;

/**
 * Prettify a stored conversation title for display as a heading.
 *
 * Strips a known import file extension, then replaces ``-``/``_``
 * runs with spaces ONLY when the remainder reads like a slug (no
 * existing whitespace) — so genuine human titles with spaces are
 * left untouched.
 */
export function prettifyConversationTitle(rawTitle: string): string {
    const noExt = rawTitle.trim().replace(IMPORT_EXTENSION, "");
    if (/\s/.test(noExt)) return noExt;
    return noExt.replace(/[-_]+/g, " ").trim();
}

/**
 * Resolve the heading title for the Import-Detail page: the analysis
 * topic when present, else the prettified stored title.
 */
export function importHeadingTitle(
    storedTitle: string,
    analysisTopic?: string | null,
): string {
    const topic = analysisTopic?.trim();
    if (topic) return topic;
    return prettifyConversationTitle(storedTitle);
}
