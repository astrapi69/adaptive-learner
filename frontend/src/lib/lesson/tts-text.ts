/**
 * markdownToSpeech — turn a theory step's Markdown body into clean,
 * readable plain text for the read-aloud engine (TTS feature C2/C5).
 *
 * The lesson viewer stores theory as Markdown; feeding the raw
 * source to speechSynthesis would read out "hash", "asterisk
 * asterisk", backticks, and URL noise. This strips the syntax to
 * the prose a learner actually wants to hear:
 *
 *   - fenced code blocks are dropped entirely (reading code aloud
 *     is useless — the same rationale that suppresses TTS on
 *     code-card exercises);
 *   - inline code keeps its inner text;
 *   - headings / list markers / blockquote markers are removed;
 *   - emphasis markers are stripped, keeping the words;
 *   - links + images collapse to their visible text / alt;
 *   - whitespace is collapsed to single spaces / paragraph breaks.
 *
 * Deliberately small + dependency-free (no remark round-trip) so it
 * stays cheap to call on every step change.
 */
export function markdownToSpeech(markdown: string): string {
    if (!markdown) return "";
    let text = markdown;

    // Drop fenced code blocks wholesale (``` … ``` and ~~~ … ~~~).
    text = text.replace(/```[\s\S]*?```/g, " ");
    text = text.replace(/~~~[\s\S]*?~~~/g, " ");

    // Images: ![alt](url) -> alt (often empty, which is fine).
    text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
    // Links: [text](url) -> text.
    text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

    // Inline code: `code` -> code.
    text = text.replace(/`([^`]+)`/g, "$1");

    // Strip emphasis / bold / strikethrough markers, keep the words.
    text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
    text = text.replace(/(\*|_)(.*?)\1/g, "$2");
    text = text.replace(/~~(.*?)~~/g, "$1");

    // Line-level markers: headings (#), blockquotes (>), list bullets
    // (-, *, +) and ordered-list numbers, and table pipes.
    text = text
        .split("\n")
        .map((line) =>
            line
                .replace(/^\s{0,3}#{1,6}\s+/, "")
                .replace(/^\s{0,3}>\s?/, "")
                .replace(/^\s*([-*+]|\d+\.)\s+/, "")
                .replace(/\|/g, " "),
        )
        .join("\n");

    // Collapse horizontal rules + leftover heading/setext underlines.
    text = text.replace(/^\s*([-=*])\1{2,}\s*$/gm, " ");

    // Normalise whitespace: collapse runs of blank lines into a single
    // paragraph break, and runs of spaces into one.
    text = text.replace(/[ \t]+/g, " ");
    text = text.replace(/\n{2,}/g, "\n");
    text = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join(". ");

    return text.trim();
}
