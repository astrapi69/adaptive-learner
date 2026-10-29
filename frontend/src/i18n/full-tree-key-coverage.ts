/**
 * Full-tree i18n key-usage extraction (#2864, #2797 Teil A follow-up).
 *
 * Pure parsing/matching helpers, no filesystem access - the filesystem walk
 * and the actual gate assertions live in the paired test file, which is
 * both this module's test suite and the gate itself.
 *
 * Three call shapes this codebase actually uses (verified by grep across
 * ~1107 files before writing this):
 *
 *   t("static.dot.path", "Fallback")           -> a STATIC key, checkable
 *                                                  against the real catalogs.
 *   t(`prefix.${expr}.suffix`, fallback)        -> a DYNAMIC key. No static
 *                                                  tool (i18next-parser
 *                                                  included) can resolve
 *                                                  ``expr`` into a concrete
 *                                                  catalog key, so this is
 *                                                  checked more weakly: does
 *                                                  ANY catalog key fit the
 *                                                  prefix/suffix shape.
 *   {key: "static.dot.path"} / labelKey="..."   -> a key HELD AS DATA (#3676):
 *                                                  a table or prop that a
 *                                                  later ``t(entry.key)``
 *                                                  reads. The value is a
 *                                                  literal, so it is checked
 *                                                  like a static key.
 *   t(variableName, fallback)                   -> UNVERIFIABLE by any
 *                                                  static tool. Counted, not
 *                                                  checked - the gate must
 *                                                  say so (quality-checks.md
 *                                                  "Gate test contract"
 *                                                  point 4), never silently
 *                                                  treat this as "0 issues".
 */

/** ``t("a.b.c", ...)`` - reuses first-paint-coverage.test.ts's exact
 *  pattern (single- or double-quoted, lowercase/digit/underscore dot
 *  segments - verified: no real call site uses a hyphen or uppercase
 *  letter in a STATIC key; hyphens only ever appear in catalog values
 *  reached via dynamic interpolation, e.g. `content.tree.domain_dog-training`
 *  reached via `` t(`content.tree.domain_${domain}`, ...) ``). */
const STATIC_KEY_PATTERN = /\bt\(\s*["']([a-z0-9_]+(?:\.[a-z0-9_]+)+)["']/g;

/** ``key: "a.b"``, ``labelKey: "a.b"``, ``name_key: "a.b"``, ``titleKey="a.b"``
 *  - a catalog key held as data in a property or prop whose name ends in
 *  ``key`` / ``Key`` (#3676). Same value shape as {@link STATIC_KEY_PATTERN},
 *  so a storage key with a hyphen (``"adaptive-learner.avatar.frames"``) or
 *  a single segment (``"streak_3_days"``) never matches. Measured before
 *  adding it: 252 such literals in the tree, every one a leaf string in all
 *  11 catalogs once the three keys #3636 removed were restored. */
const DATA_HELD_KEY_PATTERN = /\b\w*[kK]ey\s*[:=]\s*["']([a-z0-9_]+(?:\.[a-z0-9_]+)+)["']/g;

/** ``t(`a.${expr}.b`, ...)`` - captures the whole template-literal body
 *  (everything between the backticks) for {@link splitDynamicTemplate}
 *  to split around the first ``${...}``. */
const DYNAMIC_TEMPLATE_PATTERN = /\bt\(\s*`([^`]*)`/g;

/** ``t(someIdentifier, ...)`` - first arg is neither a quoted string nor
 *  a template literal, so it is a bare expression (a variable, a member
 *  access, a ternary...). Counts these; never claims to check them. */
const BARE_CALL_PATTERN = /\bt\(\s*([^"'`\s)][^)]*)/g;

/**
 * Strip line comments and block comments before extraction - found
 * necessary immediately: this module's OWN docstrings illustrate the
 * three call shapes with literal ``t("static.dot.path", ...)``/
 * ``` t(`a.${expr}.b`) ``` examples, which the raw regexes above happily
 * "extract" as if they were real call sites. A doc comment anywhere in
 * the tree can do the same.
 *
 * Known, accepted limitation: a ``//`` or block-comment marker INSIDE a
 * string literal (e.g. a URL in a fallback string) truncates the rest of
 * that line/block as if it were a comment. This cannot corrupt a STATIC
 * key extraction on the same line (the key itself is captured before any
 * such truncation point), and no real call site in this codebase puts a
 * comment marker inside a template-literal dynamic key - verified by the
 * gate itself staying green after this was added.
 */
export function stripComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
}

export interface DynamicKeyPattern {
    /** The literal text before the first ``${``. */
    prefix: string;
    /** The literal text after the matching ``}`` of the FIRST
     *  interpolation - a second interpolation in the same template (none
     *  found in this codebase today) is folded into the suffix as literal
     *  text, which only makes the sanity check slightly more lenient, not
     *  incorrect. */
    suffix: string;
}

/** Extract every static, fully-literal ``t()`` key from `source`. */
export function extractStaticKeys(source: string): string[] {
    const keys: string[] = [];
    for (const match of source.matchAll(STATIC_KEY_PATTERN)) keys.push(match[1]);
    return keys;
}

/** Extract every catalog key held as a literal in a ``*key`` / ``*Key``
 *  property or prop (#3676). */
export function extractDataHeldKeys(source: string): string[] {
    const keys: string[] = [];
    for (const match of source.matchAll(DATA_HELD_KEY_PATTERN)) keys.push(match[1]);
    return keys;
}

/** Split one template-literal body around its first ``${...}`` into a
 *  {prefix, suffix} pair, or ``null`` when the template has no
 *  interpolation at all (a plain backtick string - rare, but not this
 *  function's job to reject; the caller's regex already requires a
 *  literal backtick call, so a template with zero ``${`` is simply not a
 *  dynamic key and is skipped by the caller instead). */
export function splitDynamicTemplate(body: string): DynamicKeyPattern | null {
    const openIndex = body.indexOf("${");
    if (openIndex === -1) return null;
    const prefix = body.slice(0, openIndex);
    // Find the matching close brace, tolerating a nested `{`/`}` inside the
    // expression (e.g. `${obj.method({x: 1})}`) by depth-counting from the
    // character right after `${`.
    let depth = 1;
    let i = openIndex + 2;
    for (; i < body.length && depth > 0; i++) {
        if (body[i] === "{") depth++;
        else if (body[i] === "}") depth--;
    }
    const suffix = body.slice(i);
    return {prefix, suffix};
}

/** Extract every dynamic (template-literal) key pattern from `source`,
 *  deduplicated - many call sites share the same prefix/suffix. */
export function extractDynamicKeyPatterns(source: string): DynamicKeyPattern[] {
    const seen = new Map<string, DynamicKeyPattern>();
    for (const match of source.matchAll(DYNAMIC_TEMPLATE_PATTERN)) {
        const split = splitDynamicTemplate(match[1]);
        if (!split) continue;
        seen.set(`${split.prefix} ${split.suffix}`, split);
    }
    return [...seen.values()];
}

/** Count ``t()`` calls whose first argument is neither a quoted string
 *  nor a template literal - unverifiable by any static extraction. */
export function countBareIdentifierCalls(source: string): number {
    let count = 0;
    for (const _ of source.matchAll(BARE_CALL_PATTERN)) count++;
    return count;
}

/** Flatten a nested catalog object into dot-path -> leaf-value entries. */
export function flattenCatalog(
    obj: Record<string, unknown>,
    prefix = "",
): Map<string, unknown> {
    const out = new Map<string, unknown>();
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix === "" ? key : `${prefix}.${key}`;
        if (value && typeof value === "object" && !Array.isArray(value)) {
            for (const [k, v] of flattenCatalog(value as Record<string, unknown>, path)) {
                out.set(k, v);
            }
        } else {
            out.set(path, value);
        }
    }
    return out;
}

/** Whether any key in `catalogKeys` fits the ``prefix<anything>suffix``
 *  shape, with at least one character between them (rejects a
 *  degenerate prefix===suffix boundary match against an empty gap). */
export function anyKeyMatchesPattern(
    catalogKeys: Iterable<string>,
    pattern: DynamicKeyPattern,
): boolean {
    for (const key of catalogKeys) {
        if (
            key.startsWith(pattern.prefix) &&
            key.endsWith(pattern.suffix) &&
            key.length > pattern.prefix.length + pattern.suffix.length
        ) {
            return true;
        }
    }
    return false;
}
