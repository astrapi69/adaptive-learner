/**
 * Catalog keys without a consumer, older than the pre-staging window (#3444).
 *
 * The reverse of ``full-tree-key-coverage``: that gate fails when code uses a
 * key no catalog has; this report lists catalog keys nothing reads. It is a
 * night-shift report, never a merge gate: translations ship before the code
 * that uses them (#2578, pr-policy.md), so a fresh key without a consumer is
 * expected for a while. Only keys that already existed ``AGE_DAYS`` ago count.
 *
 * A key counts as used when any of these reads it (each channel exists
 * because a key was once wrongly called dead, #3636 / #3676 / #2477):
 *
 *   - a static ``t("a.b")`` call, in the app or in an ``@astrapi69/*``
 *     package that receives the app's ``t`` (the key vault renders
 *     ``settings.key_vault.*`` itself);
 *   - a key held as data (``key: "a.b"``, :func:`extractDataHeldKeys`);
 *   - a dynamic ``t(`a.${x}.b`)`` pattern the key fits, or the same shape
 *     built outside ``t()`` and handed to it later (``edit-error-keys.ts``
 *     returns ``create_lesson.exercises.edit.err_${code}``, #3709,
 *     :func:`extractKeyTemplates`);
 *   - the key as a literal anywhere in a non-catalog text file (Python,
 *     YAML templates, key lists such as ``i18n/shell-keys.json``);
 *   - a block consumer: a file that reads a whole top-level block
 *     (``catalog.repo``, ``loaded.get("repo")``) and names the leaf field,
 *     as ``lib/learning-repo/labels.ts`` and its Python twin do for ``repo.*``.
 *
 * @example
 * const unused = findUnusedKeys(catalogKeys, scan);
 * const report = agedUnusedKeys(unused, catalogKeysAgeDaysAgo);
 */

import {anyKeyMatchesPattern, splitDynamicTemplate, type DynamicKeyPattern} from "./full-tree-key-coverage";

/** Days a key may sit in the catalogs without a consumer (pre-staging window). */
export const AGE_DAYS = 14;

/** What the source scan found, channel by channel. */
export interface ConsumerScan {
    /** Static and data-held keys (``t("a.b")``, ``key: "a.b"``). */
    namedKeys: ReadonlySet<string>;
    /** Dynamic ``t(`a.${x}.b`)`` shapes. */
    dynamicPatterns: readonly DynamicKeyPattern[];
    /** Text of every non-catalog source file (comments kept: a key named in
     *  a YAML comment or docstring is rare, and keeping it only errs towards
     *  "used", the safe side for a deletion report). */
    texts: readonly string[];
}

/** A template literal that opens with a dotted key path and interpolates. */
const KEY_TEMPLATE = /`([a-z0-9_]+\.[a-z0-9_.]*\$\{[^`]*)`/g;

/**
 * Key shapes built in a template literal outside ``t()``, as dynamic patterns.
 *
 * A helper such as ``exerciseEditErrorKey`` returns
 * ``create_lesson.exercises.edit.err_${code}`` and the caller passes the
 * result to ``t()``; the ``t()``-only extraction never sees it (#3709). Only
 * templates whose literal prefix is a dotted key path count, so URLs and
 * plain labels stay out.
 */
export function extractKeyTemplates(source: string): DynamicKeyPattern[] {
    const seen = new Map<string, DynamicKeyPattern>();
    for (const match of source.matchAll(KEY_TEMPLATE)) {
        const split = splitDynamicTemplate(match[1]);
        if (split) seen.set(`${split.prefix} ${split.suffix}`, split);
    }
    return [...seen.values()];
}

/**
 * ``splitDynamicTemplate`` keeps a second interpolation as literal text in
 * the suffix (``lesson.exercise.instruction.${type}.${mode}`` gives suffix
 * ``.${mode}``), which no catalog key ends with. For this report only the
 * text after the LAST interpolation is a fixed suffix (#3709).
 */
function widenSuffix(pattern: DynamicKeyPattern): DynamicKeyPattern {
    const last = pattern.suffix.lastIndexOf("}");
    return pattern.suffix.includes("${") ? {...pattern, suffix: pattern.suffix.slice(last + 1)} : pattern;
}

/** Thrown when the report's basis is missing; it must never read as clean. */
export class ReportBasisError extends Error {}

const BLOCK_ACCESS = /(?:\bcatalog\.([a-z0-9_]+)\b|\.get\(\s*["']([a-z0-9_]+)["']|\[\s*["']([a-z0-9_]+)["']\s*\])/g;

/** Top-level block -> the words of every text that reads that block whole. */
function blockConsumers(texts: readonly string[], blocks: ReadonlySet<string>): Map<string, Set<string>[]> {
    const consumers = new Map<string, Set<string>[]>();
    for (const text of texts) {
        let words: Set<string> | null = null;
        const seen = new Set<string>();
        for (const match of text.matchAll(BLOCK_ACCESS)) {
            const block = match[1] ?? match[2] ?? match[3];
            if (!blocks.has(block) || seen.has(block)) continue;
            seen.add(block);
            words ??= new Set(text.match(/\w+/g) ?? []);
            consumers.set(block, [...(consumers.get(block) ?? []), words]);
        }
    }
    return consumers;
}

const WORD_CHAR = /\w/;

/** ``key`` occurs in ``text`` on its own: not inside a longer word or a
 *  longer dotted path (``nav.homepage`` and ``x.nav.home`` do not count). */
function namedLiterally(key: string, texts: readonly string[]): boolean {
    return texts.some((text) => {
        for (let at = text.indexOf(key); at !== -1; at = text.indexOf(key, at + 1)) {
            const before = at > 0 ? text[at - 1] : "";
            const after = text[at + key.length] ?? "";
            if (!WORD_CHAR.test(before) && before !== "." && !WORD_CHAR.test(after)) return true;
        }
        return false;
    });
}

function readByBlockConsumer(key: string, consumers: Map<string, Set<string>[]>): boolean {
    const [block, ...rest] = key.split(".");
    if (rest.length !== 1) return false;
    return (consumers.get(block) ?? []).some((words) => words.has(rest[0]));
}

/**
 * Every catalog key no channel reads, sorted.
 *
 * @throws ReportBasisError when there are no catalog keys or no sources: an
 *   empty basis would report "nothing unused" and read as clean.
 */
export function findUnusedKeys(catalogKeys: readonly string[], scan: ConsumerScan): string[] {
    if (catalogKeys.length === 0) throw new ReportBasisError("no catalog keys to check");
    if (scan.texts.length === 0) throw new ReportBasisError("no source files scanned");
    const blocks = new Set(catalogKeys.map((key) => key.split(".")[0]));
    const consumers = blockConsumers(scan.texts, blocks);
    const patterns = scan.dynamicPatterns.map(widenSuffix);
    return catalogKeys
        .filter(
            (key) =>
                !scan.namedKeys.has(key) &&
                !patterns.some((pattern) => anyKeyMatchesPattern([key], pattern)) &&
                !namedLiterally(key, scan.texts) &&
                !readByBlockConsumer(key, consumers),
        )
        .sort();
}

/**
 * The unused keys that already existed ``AGE_DAYS`` ago.
 *
 * @throws ReportBasisError when the old catalog is empty (a shallow clone or a
 *   wrong ref would otherwise age every key out and report nothing).
 */
export function agedUnusedKeys(unused: readonly string[], keysAgeDaysAgo: ReadonlySet<string>): string[] {
    if (keysAgeDaysAgo.size === 0) throw new ReportBasisError(`no catalog from ${AGE_DAYS} days ago`);
    return unused.filter((key) => keysAgeDaysAgo.has(key));
}

/** Counts that say what the report looked at (gate contract point 4, #2083). */
export interface ReportCounts {
    keysChecked: number;
    filesScanned: number;
    unused: number;
    aged: number;
}

/** The issue body: counts first, then the aged keys grouped by top-level block. */
export function renderReport(aged: readonly string[], counts: ReportCounts, measuredAt: string): string {
    const byBlock = new Map<string, string[]>();
    for (const key of aged) {
        const block = key.split(".")[0];
        byBlock.set(block, [...(byBlock.get(block) ?? []), key]);
    }
    const lines = [
        `Catalog keys without a consumer that are older than ${AGE_DAYS} days (#3444), measured on develop at ${measuredAt}.`,
        "",
        `Checked ${counts.keysChecked} keys of the English catalog against ${counts.filesScanned} source files: ` +
            `${counts.unused} without a consumer, ${counts.aged} of them older than ${AGE_DAYS} days.`,
        "",
        "**Every key below is a candidate, not a finding.** Remove a key only after checking that one key " +
            "by hand: keys composed at run time (a helper that builds the key, a template with several " +
            "interpolations), error codes the backend returns, packages, Python, YAML, keys held as data or " +
            "read as a whole block (#3636, #3676, #2486). The reason is the dangerous direction: a consumer " +
            "shape the detector does not read reports a used key as unused; #3714 found 27 such keys before " +
            "anything was removed.",
        "",
    ];
    for (const block of [...byBlock.keys()].sort()) {
        const keys = byBlock.get(block) ?? [];
        lines.push(`<details><summary><code>${block}</code> (${keys.length})</summary>`, "");
        for (const key of keys) lines.push(`- \`${key}\``);
        lines.push("", "</details>", "");
    }
    return lines.join("\n");
}
