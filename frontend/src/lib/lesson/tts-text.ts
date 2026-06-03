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

/** A minimal step shape for the continuous-reading scan. */
export interface TheoryRunStep {
    type: string;
    body?: string | null;
}

export interface TheoryRun {
    /** Absolute step indices in the run (consecutive theory steps). */
    indices: number[];
    /** The concatenated speech text fed as ONE utterance. */
    text: string;
    /** ``offsets[k]`` = char offset of ``indices[k]``'s segment within
     *  ``text``, so a boundary charIndex maps back to a step. */
    offsets: number[];
}

/** Single space between steps — a light pause without doubling the
 *  sentence periods markdownToSpeech already inserts. */
const RUN_SEPARATOR = " ";

/**
 * Collect the run of consecutive ``theory`` steps starting at
 * ``startIndex`` (TTS feature C7 — continuous reading). Stops at the
 * first non-theory step. Returns the concatenated speech text + the
 * per-step char offsets so the viewer can auto-advance as the engine
 * crosses each boundary. Steps whose body strips to empty are skipped
 * but still keep the run going (a blank theory step shouldn't break a
 * continuous read).
 */
export function collectTheoryRun(
    steps: TheoryRunStep[],
    startIndex: number,
): TheoryRun {
    const indices: number[] = [];
    const segments: string[] = [];
    for (let i = startIndex; i < steps.length; i++) {
        if (steps[i].type !== "theory") break;
        indices.push(i);
        segments.push(markdownToSpeech(steps[i].body ?? ""));
    }
    const offsets: number[] = [];
    let acc = "";
    segments.forEach((seg, k) => {
        offsets.push(acc.length);
        acc += seg;
        if (k < segments.length - 1) acc += RUN_SEPARATOR;
    });
    return {indices, text: acc, offsets};
}

/** Map a boundary charIndex back to a run step index (the highest
 *  offset that is <= charIndex). Returns the absolute step index, or
 *  -1 when the run is empty. */
export function runStepForChar(run: TheoryRun, charIndex: number): number {
    let k = -1;
    for (let i = 0; i < run.offsets.length; i++) {
        if (run.offsets[i] <= charIndex) k = i;
        else break;
    }
    return k === -1 ? -1 : run.indices[k];
}

export interface TheoryBlock {
    /** First + last absolute index of the contiguous theory block. */
    start: number;
    end: number;
    /** 1-based position of ``index`` within the block, and the block
     *  size — drives "Step {position} of {total} theory steps". */
    position: number;
    total: number;
}

/**
 * The contiguous run of theory steps that CONTAINS ``index`` (scanning
 * both directions), used by the read-aloud mini-player's step skip +
 * "Step X of N theory steps" readout (TTS feature C8). Returns null
 * when ``index`` is not a theory step.
 */
export function theoryBlockAround(
    steps: TheoryRunStep[],
    index: number,
): TheoryBlock | null {
    if (index < 0 || index >= steps.length) return null;
    if (steps[index].type !== "theory") return null;
    let start = index;
    while (start - 1 >= 0 && steps[start - 1].type === "theory") start--;
    let end = index;
    while (end + 1 < steps.length && steps[end + 1].type === "theory") end++;
    return {
        start,
        end,
        position: index - start + 1,
        total: end - start + 1,
    };
}
